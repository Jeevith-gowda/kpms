export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectFilterChanged } from "@/lib/airfilter-dates";
import { sendSms } from "@/lib/openphone";
import Groq from "groq-sdk";
import fs from "fs";

/** Ensures phone is in E.164 format for OpenPhone API. */
function formatE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return phone;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function POST(req: NextRequest) {
  const payload = await req.json();
  console.log("Webhook payload received:", JSON.stringify(payload, null, 2));
  
  try {
    fs.writeFileSync("webhook-payload.json", JSON.stringify(payload, null, 2));
  } catch (e) {}

  try {
    const event = payload?.type ?? payload?.event;
    const msgData = payload?.data?.object ?? payload?.data ?? payload?.message ?? payload;

    const direction = msgData.direction; // "incoming" or "outgoing"
    const isOutbound = direction === "outgoing" || direction === "outbound";
    
    const targetPhoneRaw = isOutbound ? (msgData.to ?? msgData.phoneNumber) : (msgData.from ?? msgData.phoneNumber);
    const phoneStr = Array.isArray(targetPhoneRaw) ? targetPhoneRaw[0] : targetPhoneRaw;

    if (!phoneStr) {
      return NextResponse.json({ ok: true });
    }

    const cleanPhone = phoneStr.replace(/\D/g, "").slice(-10);
    const body = msgData.body ?? msgData.text ?? msgData.content ?? "";
    const externalId = msgData.id ?? msgData.messageId;

    let conversation = await prisma.conversation.findFirst({
      where: { phoneNumber: { contains: cleanPhone } },
    });

    if (!conversation) {
      const tenant = await prisma.tenant.findFirst({
        where: { primaryPhone: { contains: cleanPhone } },
      });
      conversation = await prisma.conversation.create({
        data: {
          phoneNumber: phoneStr,
          tenantId: tenant?.id,
          inboxStatus: "open",
          lastMessageAt: new Date(),
        },
      });
    }

    const messageExternalId = externalId ?? `inbound-${Date.now()}`;
    const existingMsg = await prisma.message.findFirst({
      where: { externalId: messageExternalId }
    });

    if (!existingMsg) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          externalId: externalId,
          direction: isOutbound ? "OUTBOUND" : "INBOUND",
          body,
          status: "delivered",
          provider: "openphone",
          sentAt: new Date(msgData.createdAt ?? Date.now()),
          rawPayload: payload as any,
        }
      });
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    const mediaUrls = msgData.media?.map((m: any) => m.url) || [];
    let handledAsAirfilter = false;

    if (conversation.tenantId && !isOutbound) {
      const activeReminder = await prisma.airfilterReminder.findFirst({
        where: {
          tenantId: conversation.tenantId,
          filterChanged: false,
          status: { notIn: ["CONFIRMED_CHANGED", "SKIPPED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (activeReminder) {
        if (mediaUrls.length > 0 && process.env.GROQ_API_KEY) {
          handledAsAirfilter = true;
          
          try {
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            const chatCompletion = await groq.chat.completions.create({
              model: "llama-3.2-90b-vision-preview",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Look at this image. Does it show an air filter? Does it have a handwritten date clearly visible on it? Respond in strict JSON format: { \"hasAirfilter\": boolean, \"hasWrittenDate\": boolean, \"date\": string | null }." },
                    { type: "image_url", image_url: { url: mediaUrls[0] } }
                  ]
                }
              ],
              temperature: 0.1,
              response_format: { type: "json_object" }
            });

            const resultStr = chatCompletion.choices[0]?.message?.content || "{}";
            const result = JSON.parse(resultStr);

            await prisma.tenantResponse.create({
              data: {
                airfilterReminderId: activeReminder.id,
                channel: "SMS",
                responseText: body || "[Image attached]",
                responseDetectedAsChanged: !!result.hasWrittenDate,
                responseConfidence: 0.9,
                associationMethod: "conversation_tenant",
                associationConfidence: 0.9,
                interpretedStatus: result.hasWrittenDate ? "CHANGED" : "NOT_CHANGED",
                autoUpdatedSystem: !!result.hasWrittenDate,
                needsManualReview: false,
              },
            });

            if (result.hasWrittenDate) {
              await prisma.airfilterReminder.update({
                where: { id: activeReminder.id },
                data: {
                  filterChanged: true,
                  filterChangedAt: new Date(),
                  status: "CONFIRMED_CHANGED",
                  tenantResponseText: body || `[Image with date confirmed: ${result.date}]`,
                  tenantResponseAt: new Date(),
                  tenantResponseChannel: "SMS",
                  autoUpdatedFromResponse: true,
                  autoUpdatedAt: new Date(),
                  requiresManualReview: false,
                },
              });
              await sendSms(formatE164(phoneStr), "Thanks! The air filter change has been confirmed with the provided date.\n\n- KPMS BOT");
            } else {
              await sendSms(formatE164(phoneStr), "Thanks for the picture! Please write today's date on the new filter with a marker, take another photo, and send it here so we can confirm the change.\n\n- KPMS BOT");
            }
          } catch (err) {
            console.error("Vision check failed:", err);
            handledAsAirfilter = false;
          }
        } else if (body) {
          const { detected, confidence, interpretedStatus } = detectFilterChanged(body);
          handledAsAirfilter = true;

          await prisma.tenantResponse.create({
            data: {
              airfilterReminderId: activeReminder.id,
              channel: "SMS",
              responseText: body,
              responseDetectedAsChanged: detected,
              responseConfidence: confidence,
              associationMethod: "conversation_tenant",
              associationConfidence: 0.9,
              interpretedStatus,
              autoUpdatedSystem: false,
              needsManualReview: interpretedStatus === "AMBIGUOUS",
            },
          });

          const toPhone = formatE164(phoneStr);
          console.log(`[airfilter] interpretedStatus=${interpretedStatus} toPhone=${toPhone}`);

          if (interpretedStatus === "CHANGED") {
            try {
              await sendSms(
                toPhone,
                `Thanks for letting us know! To complete the confirmation, please send a photo of the new air filter with today's date written on it.\n\n- KPMS BOT`
              );
              console.log(`[airfilter] Photo-request SMS sent to ${toPhone}`);
            } catch (smsErr) {
              console.error("[airfilter] Failed to send CHANGED SMS:", smsErr);
            }
            await prisma.airfilterReminder.update({
              where: { id: activeReminder.id },
              data: { requiresManualReview: true },
            });

          } else if (interpretedStatus === "NOT_CHANGED") {
            try {
              await sendSms(
                toPhone,
                `No problem! We'll continue to send you reminders. Please change the air filter as soon as possible and reply here with a photo once done.\n\n- KPMS BOT`
              );
              console.log(`[airfilter] NOT_CHANGED SMS sent to ${toPhone}`);
            } catch (smsErr) {
              console.error("[airfilter] Failed to send NOT_CHANGED SMS:", smsErr);
            }

          } else {
            // AMBIGUOUS — flag for manual review, no auto-response
            await prisma.airfilterReminder.update({
              where: { id: activeReminder.id },
              data: { requiresManualReview: true },
            });
          }
        }
      }
    }

    if (!isOutbound && !handledAsAirfilter) {
      const settings = await prisma.appSettings.findFirst({ orderBy: { createdAt: "desc" } });
      if (settings?.enableAutoResponsesToMessages && process.env.GROQ_API_KEY && process.env.GROQ_MODEL_NAME) {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const messages = await prisma.message.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: "asc" },
          take: 20,
        });

        const convWithCtx = await prisma.conversation.findUnique({
          where: { id: conversation.id }
        });
        const property = convWithCtx?.propertyId ? await prisma.property.findUnique({ where: { id: convWithCtx.propertyId } }) : null;
        const tenant = convWithCtx?.tenantId ? await prisma.tenant.findUnique({ where: { id: convWithCtx.tenantId } }) : null;

        let systemPrompt = `You are an AI assistant for a professional property management company.
Your job is to generate a short, professional, and helpful SMS-style response to the tenant.
Do NOT make unsupported promises or financial guarantees.
Do NOT reveal internal-only data.
Keep it concise and conversational.
Always sign off with "- KPMS BOT" on a new line at the very end.`;

        if (property) {
          systemPrompt += `\nProperty Context: ${property.address1}, ${property.city}, ${property.state}.`;
        }
        if (tenant) {
          systemPrompt += `\nTenant Context: ${tenant.fullName}.`;
        }

        const chatMessages: any[] = [{ role: "system", content: systemPrompt }];
        for (const msg of messages) {
          chatMessages.push({
            role: msg.direction === "INBOUND" ? "user" : "assistant",
            content: msg.body,
          });
        }

        const chatCompletion = await groq.chat.completions.create({
          messages: chatMessages,
          model: process.env.GROQ_MODEL_NAME,
          temperature: 0.3,
          max_tokens: 250,
        });

        const draftText = chatCompletion.choices[0]?.message?.content?.trim() || "";

        if (draftText) {
          const toPhone = settings.sendEveryMessageToDefaultNumber && settings.defaultTestPhoneNumber
            ? settings.defaultTestPhoneNumber
            : conversation.phoneNumber;

          let providerMessageId: string | undefined;
          let status = "sent";

          try {
            const result = await sendSms(toPhone, draftText);
            providerMessageId = result.messageId;
          } catch {
            status = "failed";
          }

          const sentMsg = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              direction: "OUTBOUND",
              body: draftText,
              status,
              provider: "openphone",
              sentAt: new Date(),
              externalId: providerMessageId,
              isAiGenerated: true,
              wasAutoSent: true,
            },
          });

          await prisma.aiReplyGeneration.create({
            data: {
              conversationId: conversation.id,
              sourceMessageId: existingMsg ? existingMsg.id : null,
              generatedReplyId: sentMsg.id,
              wasAutoSent: true,
              autoSendDecision: "AUTO_SENT",
              autoSendDecisionReason: "Settings enabled auto responses.",
              draftText,
            }
          });

          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date() },
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectFilterChanged } from "@/lib/airfilter-dates";
import { sendSms } from "@/lib/openphone";
import Groq from "groq-sdk";
import fs from "fs";

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

    let handledAsAirfilter = false;

    if (body && conversation.tenantId && !isOutbound) {
      const { detected, confidence, interpretedStatus } = detectFilterChanged(body);

      const activeReminder = await prisma.airfilterReminder.findFirst({
        where: {
          tenantId: conversation.tenantId,
          filterChanged: false,
          status: { notIn: ["CONFIRMED_CHANGED", "SKIPPED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (activeReminder) {
        const needsManualReview = interpretedStatus === "AMBIGUOUS";
        const autoUpdatedSystem = interpretedStatus === "CHANGED" && confidence >= 0.8;

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
            autoUpdatedSystem,
            needsManualReview,
          },
        });

        if (autoUpdatedSystem) {
          handledAsAirfilter = true;
          await prisma.airfilterReminder.update({
            where: { id: activeReminder.id },
            data: {
              filterChanged: true,
              filterChangedAt: new Date(),
              status: "CONFIRMED_CHANGED",
              tenantResponseText: body,
              tenantResponseAt: new Date(),
              tenantResponseChannel: "SMS",
              autoUpdatedFromResponse: true,
              autoUpdatedAt: new Date(),
              requiresManualReview: false,
            },
          });
        } else if (needsManualReview) {
          handledAsAirfilter = true;
          await prisma.airfilterReminder.update({
            where: { id: activeReminder.id },
            data: { requiresManualReview: true }
          });
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
Sign off as "KPMS BOT".`;

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

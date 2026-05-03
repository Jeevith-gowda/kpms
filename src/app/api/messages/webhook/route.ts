import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectFilterChanged } from "@/lib/airfilter-dates";

import fs from "fs";

export async function POST(req: NextRequest) {
  const payload = await req.json();
  console.log("Webhook payload received:", JSON.stringify(payload, null, 2));
  
  // DEBUG: Write payload to file so we can inspect it
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

    // Find or create conversation
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

    await prisma.message.upsert({
      where: { externalId: externalId ?? `inbound-${Date.now()}` },
      update: {},
      create: {
        conversationId: conversation.id,
        externalId: externalId,
        direction: isOutbound ? "OUTBOUND" : "INBOUND",
        body,
        status: "delivered",
        provider: "openphone",
        sentAt: new Date(msgData.createdAt ?? Date.now()),
        rawPayload: payload,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    // Check for filter change confirmation
    if (body && conversation.tenantId) {
      const { detected, confidence } = detectFilterChanged(body);

      const activeReminder = await prisma.airfilterReminder.findFirst({
        where: {
          tenantId: conversation.tenantId,
          filterChanged: false,
          status: { notIn: ["CONFIRMED_CHANGED", "SKIPPED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (activeReminder) {
        await prisma.tenantResponse.create({
          data: {
            airfilterReminderId: activeReminder.id,
            channel: "SMS",
            responseText: body,
            responseDetectedAsChanged: detected,
            responseConfidence: confidence,
          },
        });

        if (detected && confidence >= 0.8) {
          await prisma.airfilterReminder.update({
            where: { id: activeReminder.id },
            data: {
              filterChanged: true,
              filterChangedAt: new Date(),
              status: "CONFIRMED_CHANGED",
              tenantResponseText: body,
              tenantResponseAt: new Date(),
              tenantResponseChannel: "SMS",
            },
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

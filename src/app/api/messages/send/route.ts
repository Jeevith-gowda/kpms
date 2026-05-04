export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/openphone";

export async function POST(req: NextRequest) {
  const { error } = await requirePermission(req, "send_messages");
  if (error) return error;

  const { conversationId, body, aiGenerationId } = await req.json();
  if (!conversationId || !body) {
    return NextResponse.json({ error: "conversationId and body are required" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const settings = await prisma.appSettings.findFirst({ orderBy: { createdAt: "desc" } });
  const toPhone = settings?.sendEveryMessageToDefaultNumber && settings.defaultTestPhoneNumber
    ? settings.defaultTestPhoneNumber
    : conversation.phoneNumber;

  let providerMessageId: string | undefined;
  let status = "sent";

  try {
    const result = await sendSms(toPhone, body);
    providerMessageId = result.messageId;
  } catch {
    status = "failed";
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      body,
      status,
      provider: "openphone",
      sentAt: new Date(),
      externalId: providerMessageId,
      isAiGenerated: !!aiGenerationId,
    },
  });

  if (aiGenerationId) {
    await prisma.aiReplyGeneration.update({
      where: { id: aiGenerationId },
      data: { generatedReplyId: message.id },
    }).catch(console.error);
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  return NextResponse.json({ ok: true, message });
}



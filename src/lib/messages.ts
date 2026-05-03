import { prisma } from "@/lib/prisma";

export async function logOutboundMessageToConversation({
  toPhone,
  messageText,
  messageId,
  tenantId,
  propertyId,
}: {
  toPhone: string;
  messageText: string;
  messageId?: string;
  tenantId?: string | null;
  propertyId?: string | null;
}) {
  const cleanPhone = toPhone.replace(/\D/g, "").slice(-10);
  let conversation = await prisma.conversation.findFirst({
    where: { phoneNumber: { contains: cleanPhone } },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        phoneNumber: toPhone,
        tenantId,
        propertyId,
        inboxStatus: "open",
        lastMessageAt: new Date(),
      },
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      body: messageText,
      status: "sent",
      provider: "openphone",
      sentAt: new Date(),
      externalId: messageId,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });
}

export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const { error } = await requirePermission(req, "view_messages");
  if (error) return error;

  const { conversationId } = await params;

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [messages, tenant, property] = await Promise.all([
    prisma.message.findMany({ where: { conversationId }, orderBy: { sentAt: "asc" } }),
    conversation.tenantId ? prisma.tenant.findUnique({ where: { id: conversation.tenantId } }) : null,
    conversation.propertyId ? prisma.property.findUnique({ where: { id: conversation.propertyId } }) : null,
  ]);

  return NextResponse.json({ conversation: { ...conversation, messages, tenant, property } });
}

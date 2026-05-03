export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, "view_messages");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";

  const conversations = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
  });

  const tenantIds = [...new Set(conversations.filter((c) => c.tenantId).map((c) => c.tenantId!))];
  const propertyIds = [...new Set(conversations.filter((c) => c.propertyId).map((c) => c.propertyId!))];

  const [tenants, properties] = await Promise.all([
    tenantIds.length ? prisma.tenant.findMany({ where: { id: { in: tenantIds } } }) : [],
    propertyIds.length ? prisma.property.findMany({ where: { id: { in: propertyIds } } }) : [],
  ]);

  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]));
  const propMap = Object.fromEntries(properties.map((p) => [p.id, p]));

  const conversationIds = conversations.map((c) => c.id);
  const recentMessages = conversationIds.length
    ? await prisma.message.findMany({
        where: { conversationId: { in: conversationIds } },
        orderBy: { sentAt: "desc" },
      })
    : [];

  const lastMsgMap: Record<string, typeof recentMessages[0]> = {};
  for (const m of recentMessages) {
    if (!lastMsgMap[m.conversationId]) lastMsgMap[m.conversationId] = m;
  }

  let enriched = conversations.map((c) => ({
    ...c,
    tenant: c.tenantId ? tenantMap[c.tenantId] : null,
    property: c.propertyId ? propMap[c.propertyId] : null,
    messages: lastMsgMap[c.id] ? [lastMsgMap[c.id]] : [],
  }));

  if (search) {
    const q = search.toLowerCase();
    enriched = enriched.filter(
      (c) =>
        c.tenant?.fullName?.toLowerCase().includes(q) ||
        c.phoneNumber?.toLowerCase().includes(q)
    );
  }

  return NextResponse.json({ conversations: enriched });
}


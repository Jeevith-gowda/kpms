export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, "view_reminder_history");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const reminderId = searchParams.get("reminderId");

  const reminders = await prisma.airfilterReminder.findMany({
    where: reminderId ? { id: reminderId } : {},
    orderBy: { nextFilterChangeDate: "desc" },
  });

  const reminderIds = reminders.map((r) => r.id);
  const propertyIds = [...new Set(reminders.map((r) => r.propertyId))];
  const tenantIds = [...new Set(reminders.filter((r) => r.tenantId).map((r) => r.tenantId!))];

  const [properties, tenants, auditLogs, deliveries, tenantResponses] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: propertyIds } } }),
    prisma.tenant.findMany({ where: { id: { in: tenantIds } } }),
    prisma.airfilterReminderAudit.findMany({
      where: { airfilterReminderId: { in: reminderIds } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.reminderDelivery.findMany({
      where: { airfilterReminderId: { in: reminderIds } },
      orderBy: { sentAt: "desc" },
    }),
    prisma.tenantResponse.findMany({
      where: { airfilterReminderId: { in: reminderIds } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const propMap = Object.fromEntries(properties.map((p) => [p.id, p]));
  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]));

  const enriched = reminders.map((r) => ({
    ...r,
    property: propMap[r.propertyId],
    tenant: r.tenantId ? tenantMap[r.tenantId] : null,
    auditLog: auditLogs.filter((a) => a.airfilterReminderId === r.id),
    deliveries: deliveries.filter((d) => d.airfilterReminderId === r.id),
    tenantResponses: tenantResponses.filter((t) => t.airfilterReminderId === r.id),
  }));

  return NextResponse.json({ reminders: enriched });
}


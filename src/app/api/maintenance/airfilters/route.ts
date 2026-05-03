export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, "view_airfilters");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") ?? "all-time";
  const search = searchParams.get("search") ?? "";
  const reminderStatus = searchParams.get("reminderStatus");
  const filterChanged = searchParams.get("filterChanged");
  const occupancyStatus = searchParams.get("occupancyStatus");

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const where: Record<string, unknown> = {};
  if (view === "current-month") {
    where.nextFilterChangeDate = { gte: currentMonthStart, lte: currentMonthEnd };
  }
  if (reminderStatus) where.status = reminderStatus;
  if (filterChanged === "true") where.filterChanged = true;
  if (filterChanged === "false") where.filterChanged = false;

  const reminders = await prisma.airfilterReminder.findMany({
    where,
    orderBy: { nextFilterChangeDate: "asc" },
  });

  const propertyIds = [...new Set(reminders.map((r) => r.propertyId))];
  const tenantIds = [...new Set(reminders.filter((r) => r.tenantId).map((r) => r.tenantId!))];

  const [properties, tenants] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: propertyIds } } }),
    prisma.tenant.findMany({ where: { id: { in: tenantIds } } }),
  ]);

  const propMap = Object.fromEntries(properties.map((p) => [p.id, p]));
  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]));

  let enriched = reminders.map((r) => ({
    ...r,
    property: propMap[r.propertyId],
    tenant: r.tenantId ? tenantMap[r.tenantId] : null,
  }));

  if (occupancyStatus) {
    enriched = enriched.filter((r) => r.property?.occupancyStatus === occupancyStatus);
  }

  if (search) {
    const q = search.toLowerCase();
    enriched = enriched.filter(
      (r) =>
        r.property?.name?.toLowerCase().includes(q) ||
        r.property?.address1?.toLowerCase().includes(q) ||
        r.tenant?.fullName?.toLowerCase().includes(q) ||
        r.tenant?.primaryPhone?.toLowerCase().includes(q) ||
        r.tenant?.email?.toLowerCase().includes(q)
    );
  }

  const dueThisMonth = await prisma.airfilterReminder.count({
    where: { nextFilterChangeDate: { gte: currentMonthStart, lte: currentMonthEnd } },
  });
  const pendingReminders = await prisma.airfilterReminder.count({
    where: { status: "PENDING", filterChanged: false },
  });
  const sentToday = await prisma.airfilterReminder.count({
    where: {
      lastReminderSentAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
    },
  });
  const confirmedChanged = await prisma.airfilterReminder.count({
    where: { status: "CONFIRMED_CHANGED" },
  });

  return NextResponse.json({
    reminders: enriched,
    summary: { dueThisMonth, pendingReminders, sentToday, confirmedChanged },
  });
}


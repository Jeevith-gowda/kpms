import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ reminderId: string }> }) {
  const { error, user } = await requirePermission(req, "update_filter_changed_status");
  if (error) return error;

  const { reminderId } = await params;
  const { filterChanged } = await req.json();

  const reminder = await prisma.airfilterReminder.findUnique({ where: { id: reminderId } });
  if (!reminder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newStatus = filterChanged ? "MANUALLY_UPDATED" : "PENDING";

  const updated = await prisma.airfilterReminder.update({
    where: { id: reminderId },
    data: {
      filterChanged,
      filterChangedAt: filterChanged ? new Date() : null,
      filterChangedByUserId: filterChanged ? user!.id : null,
      status: newStatus,
    },
  });

  await prisma.airfilterReminderAudit.create({
    data: {
      airfilterReminderId: reminderId,
      previousStatus: reminder.status,
      newStatus,
      notes: `Filter changed set to ${filterChanged} by staff`,
      createdByUserId: user!.id,
    },
  });

  return NextResponse.json({ ok: true, reminder: updated });
}

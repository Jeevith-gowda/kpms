export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ reminderId: string }> }) {
  const { error, user } = await requirePermission(req, "update_filter_changed_status");
  if (error) return error;

  const { reminderId } = await params;
  const { status } = await req.json();

  const reminder = await prisma.airfilterReminder.findUnique({ where: { id: reminderId } });
  if (!reminder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.airfilterReminder.update({
    where: { id: reminderId },
    data: { status },
  });

  await prisma.airfilterReminderAudit.create({
    data: {
      airfilterReminderId: reminderId,
      previousStatus: reminder.status,
      newStatus: status,
      notes: `Status updated manually`,
      createdByUserId: user!.id,
    },
  });

  return NextResponse.json({ ok: true, reminder: updated });
}

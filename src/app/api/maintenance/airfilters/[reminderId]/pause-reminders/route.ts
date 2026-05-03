export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ reminderId: string }> }) {
  const { error, user } = await requirePermission(req, "pause_or_resume_reminders");
  if (error) return error;

  const { reminderId } = await params;
  const { pauseReminders } = await req.json();

  const reminder = await prisma.airfilterReminder.findUnique({ where: { id: reminderId } });
  if (!reminder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.airfilterReminder.update({
    where: { id: reminderId },
    data: { pauseReminders },
  });

  await prisma.airfilterReminderAudit.create({
    data: {
      airfilterReminderId: reminderId,
      previousStatus: reminder.status,
      newStatus: reminder.status,
      notes: `Reminders ${pauseReminders ? "paused" : "resumed"} by staff`,
      createdByUserId: user!.id,
    },
  });

  return NextResponse.json({ ok: true, reminder: updated });
}

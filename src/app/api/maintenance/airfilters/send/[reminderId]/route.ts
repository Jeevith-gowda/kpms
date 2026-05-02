import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/openphone";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: Promise<{ reminderId: string }> }) {
  const { error, user } = await requirePermission(req, "send_reminder_manually");
  if (error) return error;

  const { reminderId } = await params;

  const reminder = await prisma.airfilterReminder.findUnique({ where: { id: reminderId } });
  if (!reminder) return NextResponse.json({ error: "Reminder not found" }, { status: 404 });

  const [property, tenant, settings] = await Promise.all([
    prisma.property.findUnique({ where: { id: reminder.propertyId } }),
    reminder.tenantId ? prisma.tenant.findUnique({ where: { id: reminder.tenantId } }) : null,
    prisma.appSettings.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  if (!settings) return NextResponse.json({ error: "Settings not configured" }, { status: 400 });

  const messageText = `Hi ${tenant?.fullName ?? "Resident"}, this is a reminder to change your air filter at ${property?.address1 ?? "your property"}. Please reply "changed" when done. Thank you!`;

  const results: { channel: string; ok: boolean; error?: string }[] = [];

  if (settings.sendViaSms && tenant?.primaryPhone) {
    const toPhone = settings.sendEveryMessageToDefaultNumber
      ? settings.defaultTestPhoneNumber!
      : tenant.primaryPhone;

    try {
      const { messageId } = await sendSms(toPhone, messageText);
      await prisma.reminderDelivery.create({
        data: {
          airfilterReminderId: reminder.id,
          channel: "SMS",
          status: "sent",
          providerMessageId: messageId,
          sentAt: new Date(),
          actualRecipient: tenant.primaryPhone,
          deliveredToRecipient: toPhone,
          usedTestRouting: settings.sendEveryMessageToDefaultNumber,
        },
      });
      results.push({ channel: "SMS", ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SMS failed";
      await prisma.reminderDelivery.create({
        data: {
          airfilterReminderId: reminder.id,
          channel: "SMS",
          status: "failed",
          sentAt: new Date(),
          actualRecipient: tenant.primaryPhone,
          deliveredToRecipient: toPhone,
          usedTestRouting: settings.sendEveryMessageToDefaultNumber,
          errorMessage: msg,
        },
      });
      results.push({ channel: "SMS", ok: false, error: msg });
    }
  }

  if (settings.sendViaEmail && tenant?.email) {
    try {
      const { messageId } = await sendEmail({
        to: tenant.email,
        subject: "Air Filter Change Reminder",
        text: messageText,
      });
      await prisma.reminderDelivery.create({
        data: {
          airfilterReminderId: reminder.id,
          channel: "EMAIL",
          status: "sent",
          providerMessageId: messageId,
          sentAt: new Date(),
          actualRecipient: tenant.email,
          deliveredToRecipient: tenant.email,
          usedTestRouting: false,
        },
      });
      results.push({ channel: "EMAIL", ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Email failed";
      await prisma.reminderDelivery.create({
        data: {
          airfilterReminderId: reminder.id,
          channel: "EMAIL",
          status: "failed",
          sentAt: new Date(),
          actualRecipient: tenant.email,
          deliveredToRecipient: tenant.email,
          usedTestRouting: false,
          errorMessage: msg,
        },
      });
      results.push({ channel: "EMAIL", ok: false, error: msg });
    }
  }

  const allFailed = results.length > 0 && results.every((r) => !r.ok);
  const newStatus = allFailed ? "FAILED" : "SENT";

  await prisma.airfilterReminder.update({
    where: { id: reminder.id },
    data: { status: newStatus, lastReminderSentAt: new Date(), sentAt: new Date() },
  });

  await prisma.airfilterReminderAudit.create({
    data: {
      airfilterReminderId: reminder.id,
      previousStatus: reminder.status,
      newStatus,
      notes: `Reminder sent manually by user ${user!.id}`,
      createdByUserId: user!.id,
    },
  });

  return NextResponse.json({ ok: true, results });
}

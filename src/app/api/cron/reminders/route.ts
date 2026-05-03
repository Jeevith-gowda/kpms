import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/openphone";
import { sendEmail } from "@/lib/email";
import { getNextReminderDate } from "@/lib/airfilter-dates";
import { logOutboundMessageToConversation } from "@/lib/messages";

// Vercel Cron Job — runs on the schedule defined in vercel.json
// Protected by CRON_SECRET to prevent unauthorized invocation
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.appSettings.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!settings?.sendMessagesAutomatically) {
      return NextResponse.json({ ok: true, skipped: "automatic sending is off" });
    }

    const now = new Date();

    const dueReminders = await prisma.airfilterReminder.findMany({
      where: {
        nextFilterChangeDate: { lte: now },
        filterChanged: false,
        pauseReminders: false,
        status: { notIn: ["CONFIRMED_CHANGED", "SKIPPED"] },
      },
    });

    const propertyIds = [...new Set(dueReminders.map((r) => r.propertyId))];
    const tenantIds = [
      ...new Set(dueReminders.filter((r) => r.tenantId).map((r) => r.tenantId!)),
    ];

    const [properties, tenants] = await Promise.all([
      prisma.property.findMany({ where: { id: { in: propertyIds } } }),
      prisma.tenant.findMany({ where: { id: { in: tenantIds } } }),
    ]);

    const propMap = Object.fromEntries(properties.map((p) => [p.id, p]));
    const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]));

    let sent = 0;
    let skipped = 0;

    for (const reminder of dueReminders) {
      // Skip if next scheduled time hasn't arrived yet
      if (
        reminder.nextReminderScheduledAt &&
        reminder.nextReminderScheduledAt > now
      ) {
        skipped++;
        continue;
      }

      const property = propMap[reminder.propertyId];
      const tenant = reminder.tenantId ? tenantMap[reminder.tenantId] : null;
      const messageText = `Hi ${tenant?.fullName ?? "Resident"}, this is a reminder to change the air filter at ${property?.address1 ?? "your property"}. When finished, please reply "changed" along with a photo of the new filter showing the current date. Thank you! - KPMS`;

      if (settings.sendViaSms && tenant?.primaryPhone) {
        const toPhone =
          settings.sendEveryMessageToDefaultNumber &&
          settings.defaultTestPhoneNumber
            ? settings.defaultTestPhoneNumber
            : tenant.primaryPhone;
        try {
          const { messageId } = await sendSms(toPhone, messageText);
          await prisma.reminderDelivery.create({
            data: {
              airfilterReminderId: reminder.id,
              channel: "SMS",
              status: "sent",
              providerMessageId: messageId,
              sentAt: now,
              actualRecipient: tenant.primaryPhone,
              deliveredToRecipient: toPhone,
              usedTestRouting: settings.sendEveryMessageToDefaultNumber,
            },
          });

          await logOutboundMessageToConversation({
            toPhone,
            messageText,
            messageId,
            tenantId: tenant.id,
            propertyId: property?.id,
          });

          sent++;
        } catch (err) {
          console.error("[cron] SMS error:", err);
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
              sentAt: now,
              actualRecipient: tenant.email,
              deliveredToRecipient: tenant.email,
              usedTestRouting: false,
            },
          });
          sent++;
        } catch (err) {
          console.error("[cron] Email error:", err);
        }
      }

      const nextScheduled = getNextReminderDate(now, settings.reminderFrequency);
      await prisma.airfilterReminder.update({
        where: { id: reminder.id },
        data: {
          status: "SENT",
          lastReminderSentAt: now,
          sentAt: now,
          nextReminderScheduledAt: nextScheduled,
        },
      });
    }

    return NextResponse.json({ ok: true, sent, skipped, total: dueReminders.length });
  } catch (err) {
    console.error("[cron] Reminder job error:", err);
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}

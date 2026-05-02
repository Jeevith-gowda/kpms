import cron from "node-cron";
import { prisma } from "./prisma";
import { sendSms } from "./openphone";
import { sendEmail } from "./email";
import { getNextReminderDate } from "./airfilter-dates";

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;

  // Run every hour
  cron.schedule("0 * * * *", async () => {
    try {
      await runReminderJob();
    } catch (err) {
      console.error("[scheduler] reminder job error:", err);
    }
  });

  console.log("[scheduler] Reminder scheduler started.");
}

async function runReminderJob() {
  const settings = await prisma.appSettings.findFirst({ orderBy: { createdAt: "desc" } });
  if (!settings?.sendMessagesAutomatically) return;

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const dueReminders = await prisma.airfilterReminder.findMany({
    where: {
      nextFilterChangeDate: { gte: currentMonthStart, lte: currentMonthEnd },
      filterChanged: false,
      pauseReminders: false,
      status: { notIn: ["CONFIRMED_CHANGED", "SKIPPED"] },
    },
  });

  for (const reminder of dueReminders) {
    // Skip if next scheduled time hasn't arrived
    if (reminder.nextReminderScheduledAt && reminder.nextReminderScheduledAt > now) continue;

    const tenant = reminder.tenantId
      ? await prisma.tenant.findUnique({ where: { id: reminder.tenantId } })
      : null;
    const property = await prisma.property.findUnique({ where: { id: reminder.propertyId } });

    const messageText = `Hi ${tenant?.fullName ?? "Resident"}, this is a reminder to change your air filter at ${property?.address1 ?? "your property"}. Please reply "changed" when done. Thank you!`;

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
            sentAt: now,
            actualRecipient: tenant.primaryPhone,
            deliveredToRecipient: toPhone,
            usedTestRouting: settings.sendEveryMessageToDefaultNumber,
          },
        });
      } catch (err) {
        console.error("[scheduler] SMS send error:", err);
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
      } catch (err) {
        console.error("[scheduler] Email send error:", err);
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
}

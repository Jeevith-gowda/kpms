export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/openphone";
import { sendEmail } from "@/lib/email";
import { logOutboundMessageToConversation } from "@/lib/messages";

export async function POST(req: NextRequest) {
  const { error, user } = await requirePermission(req, "send_bulk_reminders");
  if (error) return error;

  const now = new Date();
  const searchParams = req.nextUrl.searchParams;
  const isDryRun = searchParams.get("dryRun") === "true";

  const settings = await prisma.appSettings.findFirst({ orderBy: { createdAt: "desc" } });
  if (!settings) return NextResponse.json({ error: "Settings not configured" }, { status: 400 });

  const dueReminders = await prisma.airfilterReminder.findMany({
    where: {
      nextFilterChangeDate: { lte: now },
      filterChanged: false,
      pauseReminders: false,
      status: { notIn: ["CONFIRMED_CHANGED", "SKIPPED"] },
    },
  });

  const propertyIds = [...new Set(dueReminders.map((r) => r.propertyId))];
  const tenantIds = [...new Set(dueReminders.filter((r) => r.tenantId).map((r) => r.tenantId!))];
  const [properties, tenants] = await Promise.all([
    prisma.property.findMany({ where: { id: { in: propertyIds } } }),
    prisma.tenant.findMany({ where: { id: { in: tenantIds } } }),
  ]);
  const propMap = Object.fromEntries(properties.map((p) => [p.id, p]));
  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]));

  if (isDryRun) {
    const targets = dueReminders.map(r => {
      const property = propMap[r.propertyId];
      const tenant = r.tenantId ? tenantMap[r.tenantId] : null;
      return {
        name: tenant?.fullName ?? "Resident",
        phone: tenant?.primaryPhone,
        email: tenant?.email,
        address: property?.address1
      };
    });
    return NextResponse.json({ ok: true, targets });
  }

  let sent = 0;
  let failed = 0;

  for (const reminder of dueReminders) {
    const property = propMap[reminder.propertyId];
    const tenant = reminder.tenantId ? tenantMap[reminder.tenantId] : null;
    const messageText = `Hi ${tenant?.fullName ?? "Resident"}, this is a reminder to change the air filter at ${property?.address1 ?? "your property"}. When finished, please reply "changed" along with a photo of the new filter showing the current date. Thank you! - KPMS`;

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

        await logOutboundMessageToConversation({
          toPhone,
          messageText,
          messageId,
          tenantId: tenant.id,
          propertyId: property?.id,
        });

        sent++;
      } catch { failed++; }
    }

    if (settings.sendViaEmail && tenant?.email) {
      try {
        await sendEmail({ to: tenant.email, subject: "Air Filter Change Reminder", text: messageText });
        await prisma.reminderDelivery.create({
          data: {
            airfilterReminderId: reminder.id,
            channel: "EMAIL",
            status: "sent",
            sentAt: new Date(),
            actualRecipient: tenant.email,
            deliveredToRecipient: tenant.email,
            usedTestRouting: false,
          },
        });
        sent++;
      } catch { failed++; }
    }

    await prisma.airfilterReminder.update({
      where: { id: reminder.id },
      data: { status: "SENT", lastReminderSentAt: new Date(), sentAt: new Date() },
    });

    await prisma.airfilterReminderAudit.create({
      data: {
        airfilterReminderId: reminder.id,
        previousStatus: reminder.status,
        newStatus: "SENT",
        notes: `Bulk reminder sent by user ${user!.id}`,
        createdByUserId: user!.id,
      },
    });
  }

  return NextResponse.json({ ok: true, sent, failed, total: dueReminders.length });
}


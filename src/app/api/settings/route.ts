import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, "view_settings_general");
  if (error) return error;

  const settings = await prisma.appSettings.findFirst({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const { error, user } = await requirePermission(req, "view_settings_general");
  if (error) return error;

  const body = await req.json();

  if (!body.sendViaSms && !body.sendViaEmail) {
    return NextResponse.json({ error: "At least one channel must be enabled" }, { status: 400 });
  }

  const existing = await prisma.appSettings.findFirst({ orderBy: { createdAt: "desc" } });

  if (existing) {
    const updated = await prisma.appSettings.update({
      where: { id: existing.id },
      data: {
        reminderFrequency: body.reminderFrequency,
        sendViaSms: body.sendViaSms,
        sendViaEmail: body.sendViaEmail,
        sendMessagesAutomatically: body.sendMessagesAutomatically,
        sendEveryMessageToDefaultNumber: body.sendEveryMessageToDefaultNumber,
        defaultTestPhoneNumber: body.defaultTestPhoneNumber ?? null,
        updatedByUserId: user!.id,
      },
    });
    return NextResponse.json({ settings: updated });
  }

  const created = await prisma.appSettings.create({
    data: {
      reminderFrequency: body.reminderFrequency ?? "EVERY_DAY",
      sendViaSms: body.sendViaSms ?? true,
      sendViaEmail: body.sendViaEmail ?? true,
      sendMessagesAutomatically: body.sendMessagesAutomatically ?? true,
      sendEveryMessageToDefaultNumber: body.sendEveryMessageToDefaultNumber ?? false,
      defaultTestPhoneNumber: body.defaultTestPhoneNumber ?? null,
      updatedByUserId: user!.id,
    },
  });
  return NextResponse.json({ settings: created });
}

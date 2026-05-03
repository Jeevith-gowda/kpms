export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, "view_settings_access");
  if (error) return error;

  const permissions = await prisma.permission.findMany({ orderBy: { permissionKey: "asc" } });
  const rolePermissions = await prisma.rolePermission.findMany();
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ permissions, rolePermissions, users });
}

export async function PUT(req: NextRequest) {
  const { error, user } = await requirePermission(req, "manage_access_settings");
  if (error) return error;

  const { employeePermissions } = await req.json();

  if (!Array.isArray(employeePermissions)) {
    return NextResponse.json({ error: "employeePermissions must be an array" }, { status: 400 });
  }

  for (const key of ALL_PERMISSION_KEYS) {
    const isEnabled = employeePermissions.includes(key);
    await prisma.rolePermission.upsert({
      where: { role_permissionKey: { role: "EMPLOYEE", permissionKey: key } },
      update: { isEnabled, updatedByUserId: user!.id },
      create: { role: "EMPLOYEE", permissionKey: key, isEnabled, updatedByUserId: user!.id },
    });
  }

  return NextResponse.json({ ok: true });
}


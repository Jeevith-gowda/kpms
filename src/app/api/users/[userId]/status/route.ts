import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { error } = await requirePermission(req, "manage_users");
  if (error) return error;

  const { userId } = await params;
  const { status } = await req.json();

  if (!["ACTIVE", "INACTIVE"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (status === "INACTIVE") {
    // Ensure at least one active admin remains
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (target?.role === "ADMIN") {
      const activeAdminCount = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
      if (activeAdminCount <= 1) {
        return NextResponse.json({ error: "At least one active Admin must remain" }, { status: 400 });
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  return NextResponse.json({ user: updated });
}

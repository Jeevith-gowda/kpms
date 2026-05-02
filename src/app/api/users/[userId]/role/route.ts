import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { error, user } = await requirePermission(req, "manage_users");
  if (error) return error;

  const { userId } = await params;
  const { role } = await req.json();

  if (!["ADMIN", "EMPLOYEE"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // Employees cannot grant Admin
  if (user!.role === "EMPLOYEE" && role === "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  return NextResponse.json({ user: updated });
}

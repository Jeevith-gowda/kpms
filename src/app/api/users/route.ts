import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const { error } = await requirePermission(req, "manage_users");
  if (error) return error;

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const { error } = await requirePermission(req, "manage_users");
  if (error) return error;

  const { name, email, role, password } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "name, email, and password are required" }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), passwordHash: hash, role: role ?? "EMPLOYEE", status: "ACTIVE", mustChangePassword: true },
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}

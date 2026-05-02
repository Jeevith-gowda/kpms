import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

export async function createSession(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(JWT_SECRET);
}

export async function verifySession(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { sub: string };
  } catch {
    return null;
  }
}

export async function getSessionUser(req?: NextRequest): Promise<SessionUser | null> {
  let token: string | undefined;

  if (req) {
    token = req.cookies.get("session")?.value;
  } else {
    const cookieStore = await cookies();
    token = cookieStore.get("session")?.value;
  }

  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload?.sub) return null;

  const user = await prisma.user.findFirst({
    where: { id: payload.sub, status: "ACTIVE" },
    select: { id: true, name: true, email: true, role: true, mustChangePassword: true },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user) return [];

  const perms = await prisma.rolePermission.findMany({
    where: { role: user.role, isEnabled: true },
    select: { permissionKey: true },
  });

  return perms.map((p) => p.permissionKey);
}

export async function hasPermission(userId: string, permissionKey: string): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  return perms.includes(permissionKey);
}

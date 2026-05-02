import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getUserPermissions } from "./auth";

export async function requireAuth(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), user: null };
  }
  return { error: null, user };
}

export async function requirePermission(req: NextRequest, permissionKey: string) {
  const { error, user } = await requireAuth(req);
  if (error || !user) return { error: error!, user: null };

  const perms = await getUserPermissions(user.id);
  if (!perms.includes(permissionKey)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      user: null,
    };
  }
  return { error: null, user };
}

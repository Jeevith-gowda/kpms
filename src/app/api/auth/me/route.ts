import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, getUserPermissions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const permissions = await getUserPermissions(user.id);
  return NextResponse.json({ user, permissions });
}

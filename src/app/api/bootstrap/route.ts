export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { bootstrapAdmin, seedPermissions } from "@/lib/seed-permissions";

export async function POST() {
  try {
    await seedPermissions();
    await bootstrapAdmin();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Bootstrap failed" }, { status: 500 });
  }
}


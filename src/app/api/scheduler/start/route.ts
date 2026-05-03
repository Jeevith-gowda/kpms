export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";

export async function POST() {
  // Scheduler is started via instrumentation.ts on server boot
  return NextResponse.json({ ok: true, message: "Scheduler runs automatically on server startup." });
}


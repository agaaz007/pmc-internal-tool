import { NextResponse } from "next/server";
import { runCallDispatch } from "@/lib/call-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runCallDispatch({ dueOnly: true, at: new Date() });
  return NextResponse.json({ ok: true, runAt: new Date().toISOString(), ...result });
}

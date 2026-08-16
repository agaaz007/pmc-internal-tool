import { NextResponse } from "next/server";
import { z } from "zod";
import { runCallDispatch } from "@/lib/call-service";

export const runtime = "nodejs";

const requestSchema = z.object({ projectId: z.string().min(1), contactId: z.string().min(1).optional() });

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  const result = await runCallDispatch({ ...parsed.data, dueOnly: false });
  if (result.requested === 0) return NextResponse.json({ error: "No call-enabled contacts were found for this project." }, { status: 404 });
  const failures = result.results.filter((item) => !item.success);
  return NextResponse.json({ ...result, failures }, { status: failures.length === result.requested ? 502 : 202 });
}

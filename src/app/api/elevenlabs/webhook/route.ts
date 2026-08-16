import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { parseElevenLabsWebhook, verifyElevenLabsSignature } from "@/lib/elevenlabs";
import { sendDailyReportEmail } from "@/lib/email";
import { ingestVoiceMemory } from "@/lib/memory-repository";
import { getDailyReportById, getReportProject, ingestVoiceCall, markReportSent, markWebhookProcessed, recordWebhookReceipt } from "@/lib/repository";
import { rebuildDailyReport } from "@/lib/reporting";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret && process.env.NODE_ENV === "production") return NextResponse.json({ error: "Webhook secret is not configured" }, { status: 503 });
  if (secret && !verifyElevenLabsSignature(rawBody, request.headers.get("elevenlabs-signature"), secret)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let parsed: ReturnType<typeof parseElevenLabsWebhook>;
  try {
    parsed = parseElevenLabsWebhook(rawBody);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid webhook body" }, { status: 400 });
  }
  const digest = createHash("sha256").update(rawBody).digest("hex");
  const isNew = await recordWebhookReceipt(parsed.eventKey, parsed.eventType, digest);
  if (!isNew) return NextResponse.json({ received: true, duplicate: true });
  if (!parsed.call) {
    await markWebhookProcessed(parsed.eventKey);
    return NextResponse.json({ received: true, ignored: parsed.eventType });
  }

  try {
    await ingestVoiceCall(parsed.call);
    await ingestVoiceMemory(parsed.call);
    const reportDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed.call.completedAt);
    const report = await rebuildDailyReport(parsed.call.projectId, reportDate);
    let email: { sent: boolean; simulated?: boolean } = { sent: false };
    if (report.callsIncluded >= report.callsExpected && report.callsExpected > 0) {
      const project = await getReportProject(parsed.call.projectId);
      const stored = await getDailyReportById(report.id);
      if (project && stored) {
        const delivery = await sendDailyReportEmail({ ...stored, projectName: project.name, projectCode: project.code });
        email = { sent: !delivery.simulated, simulated: delivery.simulated };
        if (!delivery.simulated) await markReportSent(report.id, delivery.id);
      }
    }
    await markWebhookProcessed(parsed.eventKey);
    return NextResponse.json({ received: true, conversationId: parsed.call.conversationId, reportId: report.id, email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    await markWebhookProcessed(parsed.eventKey, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

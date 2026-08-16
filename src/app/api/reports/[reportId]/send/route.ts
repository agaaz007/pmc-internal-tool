import { NextResponse } from "next/server";
import { sendDailyReportEmail } from "@/lib/email";
import { getDailyReportById, markReportSent } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const report = await getDailyReportById(reportId);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  try {
    const delivery = await sendDailyReportEmail(report);
    if (!delivery.simulated) await markReportSent(report.id, delivery.id);
    return NextResponse.json({ ok: true, ...delivery });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Email delivery failed" }, { status: 502 });
  }
}

import type { DailyReport } from "./types";

export async function sendDailyReportEmail(report: DailyReport & { projectName: string; projectCode: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const recipients = report.recipients.length ? report.recipients : (process.env.DPR_HEAD_OFFICE_EMAIL ? [process.env.DPR_HEAD_OFFICE_EMAIL] : []);
  if (!apiKey || recipients.length === 0) return { simulated: true, id: `preview_${report.id}` };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", "idempotency-key": report.id },
    body: JSON.stringify({
      from: process.env.DPR_FROM_EMAIL || "FieldBrief <reports@example.com>",
      to: recipients,
      subject: `[${report.projectCode}] Daily Progress Report — ${report.date}`,
      html: renderReportEmail(report),
    }),
  });
  const body = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok || !body.id) throw new Error(`Email delivery failed (${response.status}): ${body.message || "Unknown provider error"}`);
  return { simulated: false, id: body.id };
}

function renderReportEmail(report: DailyReport & { projectName: string; projectCode: string }) {
  const list = (title: string, items: string[]) => `<div style="padding:20px 0;border-top:1px solid #e6e1d7"><h3 style="margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#607068">${escape(title)}</h3><ul style="margin:0;padding-left:20px">${items.length ? items.map((item) => `<li style="margin:0 0 8px;line-height:1.5">${escape(item)}</li>`).join("") : "<li>No item reported</li>"}</ul></div>`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return `<!doctype html><html><body style="margin:0;background:#f5f1e9;color:#1e2924;font-family:system-ui,sans-serif"><div style="max-width:720px;margin:0 auto;padding:36px 20px"><div style="background:#fbf9f4;border-radius:20px;padding:36px;box-shadow:0 12px 34px rgba(59,54,43,.08)"><div style="font-size:18px;font-weight:700;color:#315c4c">FieldBrief</div><p style="margin:6px 0 28px;font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#7a847f">Daily progress report · ${escape(report.projectCode)}</p><h1 style="margin:0 0 5px;font-family:Georgia,serif;font-size:32px;font-weight:500">${escape(report.projectName)}</h1><p style="margin:0 0 24px;color:#7a847f">${escape(report.date)} · ${report.callsIncluded}/${report.callsExpected} calls included</p><p style="font-family:Georgia,serif;font-size:17px;line-height:1.65;color:#405048">${escape(report.executiveSummary)}</p>${list("Work completed", report.workCompleted)}${list("Plan for tomorrow", report.plannedTomorrow)}${list("Blockers and decisions needed", report.blockers)}${list("Safety observations", report.safetyNotes)}${appUrl ? `<p style="margin:24px 0 0"><a href="${escape(appUrl)}/projects/${escape(report.projectId)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#243c33;color:white;text-decoration:none;font-size:12px">Open project dashboard</a></p>` : ""}</div></div></body></html>`;
}

function escape(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] || char); }

import type { DailyReport } from "./types";
import { getCompletedCallsForReport, getReportProject, upsertDailyReport } from "./repository";

export interface ReportCallInput {
  conversationId: string;
  summary: string;
  answers: Record<string, string>;
}

export function composeDailyReport(project: { id: string; name: string; code: string; recipients: string[]; expectedCalls: number }, reportDate: string, calls: ReportCallInput[]): DailyReport {
  const completed = unique(calls.map((call) => call.answers.work_completed));
  const tomorrow = unique(calls.map((call) => call.answers.tomorrow_plan));
  const blockers = unique(calls.flatMap((call) => [call.answers.blockers, call.answers.challenges]).filter((value) => !isEmptyResponse(value)));
  const safety = unique(calls.map((call) => call.answers.safety));
  const manpower = Math.max(0, ...calls.map((call) => firstNumber(call.answers.manpower)));
  const executiveSummary = buildExecutiveSummary(project.name, calls.length, project.expectedCalls, completed, blockers, safety);
  return {
    id: `dpr-${project.id}-${reportDate}`,
    projectId: project.id,
    date: reportDate,
    status: "draft",
    recipients: project.recipients,
    executiveSummary,
    workCompleted: completed,
    plannedTomorrow: tomorrow,
    blockers,
    safetyNotes: safety,
    manpower,
    callsIncluded: calls.length,
    callsExpected: project.expectedCalls,
    sourceConversationIds: calls.map((call) => call.conversationId),
    weather: "",
  };
}

export async function rebuildDailyReport(projectId: string, reportDate: string) {
  const [project, calls] = await Promise.all([getReportProject(projectId), getCompletedCallsForReport(projectId, reportDate)]);
  if (!project) throw new Error(`Project ${projectId} not found`);
  return upsertDailyReport(composeDailyReport(project, reportDate, calls));
}

function buildExecutiveSummary(projectName: string, included: number, expected: number, completed: string[], blockers: string[], safety: string[]) {
  const coverage = `${included} of ${expected} scheduled site conversations`;
  const progress = completed[0] ? `The leading reported progress was: ${trimSentence(completed[0])}.` : "No completed-work detail has been verified yet.";
  const risk = blockers[0] ? `The primary current exposure is: ${trimSentence(blockers[0])}.` : "No material blocker was reported in the completed calls.";
  const hasIncident = safety.some((item) => !isEmptyResponse(item) && !/(no |zero|none|nil)/i.test(item));
  return `${projectName}'s brief currently covers ${coverage}. ${progress} ${risk} ${hasIncident ? "A safety observation requires review." : "No safety incident has been reported."}`;
}

function unique(values: Array<string | undefined>) {
  const seen = new Set<string>();
  return values.map((value) => value?.trim() ?? "").filter((value) => {
    if (isEmptyResponse(value)) return false;
    const key = value.toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isEmptyResponse(value?: string) { return !value || /^(none|none reported|no issue|no issues|no blocker|no blockers|n\/a|nil|not applicable)$/i.test(value.trim()); }
function firstNumber(value?: string) { const match = value?.replace(/,/g, "").match(/\b\d+\b/); return match ? Number(match[0]) : 0; }
function trimSentence(value: string) { return value.trim().replace(/[.!?]+$/, ""); }

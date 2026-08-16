import { getAllDemoProjects, getDemoProgram, getDemoProject } from "./demo-data";
import { hasDatabase, query } from "./db";
import type { BrainFact, DailyReport, Issue, Milestone, ProgramOverview, ProjectDetail, ProjectSummary, SiteCall, SiteContact } from "./types";

export interface DispatchTarget {
  contactId: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  projectLocation: string;
  timezone: string;
  contactName: string;
  contactRole: string;
  phoneE164: string | null;
  preferredLanguage: string;
  reportRecipients: string[];
}

export interface VoiceContext {
  previousContext: string;
  openIssues: string;
  milestones: string;
  reportDate: string;
}

export interface IngestedVoiceCall {
  conversationId: string;
  projectId: string;
  contactId: string;
  startedAt: Date;
  completedAt: Date;
  durationSeconds: number;
  language?: string;
  sentiment?: string;
  summary: string;
  transcript: unknown[];
  answers: Record<string, string>;
  analysis: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function formatDate(value: unknown, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", options).format(date);
}

function formatDateTime(value: unknown) {
  if (!value) return "Never";
  const date = value instanceof Date ? value : new Date(String(value));
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(date).replace(",", " ·");
}

function mapProjectSummary(row: Record<string, unknown>): ProjectSummary {
  const callsExpected = number(row.calls_expected);
  const callsCompleted = number(row.calls_completed);
  return {
    id: text(row.id),
    code: text(row.code),
    name: text(row.name),
    location: text(row.location),
    region: text(row.region),
    phase: text(row.phase, "Mobilisation") as ProjectSummary["phase"],
    status: text(row.status, "on-track") as ProjectSummary["status"],
    progress: Math.round(number(row.progress)),
    plannedProgress: Math.round(number(row.planned_progress)),
    openIssues: number(row.open_issues),
    criticalIssues: number(row.critical_issues),
    callsCompleted,
    callsExpected,
    reportStatus: (row.report_status === "sent" ? "sent" : callsCompleted >= callsExpected && callsExpected > 0 ? "drafting" : "awaiting-calls"),
    updatedAt: formatDateTime(row.updated_at),
    manager: text(row.manager_name),
    nextMilestone: text(row.next_milestone),
    nextMilestoneDate: formatDate(row.next_milestone_date),
    accent: text(row.accent, "#315c4c"),
  };
}

const projectOverviewSql = `
  SELECT p.*,
    COUNT(DISTINCT i.id) FILTER (WHERE i.status <> 'resolved')::int AS open_issues,
    COUNT(DISTINCT i.id) FILTER (WHERE i.status <> 'resolved' AND i.severity = 'critical')::int AS critical_issues,
    COUNT(DISTINCT c.id) FILTER (WHERE c.call_enabled)::int AS calls_expected,
    COUNT(DISTINCT vc.contact_id) FILTER (
      WHERE vc.status = 'completed'
        AND (vc.completed_at AT TIME ZONE p.timezone)::date = (now() AT TIME ZONE p.timezone)::date
    )::int AS calls_completed,
    MAX(dr.status) FILTER (WHERE dr.report_date = (now() AT TIME ZONE p.timezone)::date) AS report_status
  FROM projects p
  LEFT JOIN issues i ON i.project_id = p.id
  LEFT JOIN project_contacts c ON c.project_id = p.id
  LEFT JOIN voice_calls vc ON vc.project_id = p.id
  LEFT JOIN daily_reports dr ON dr.project_id = p.id
  WHERE p.active = true
  GROUP BY p.id
  ORDER BY CASE p.status WHEN 'at-risk' THEN 1 WHEN 'watch' THEN 2 ELSE 3 END, p.name`;

export async function getProgramOverview(): Promise<ProgramOverview> {
  if (!hasDatabase()) return getDemoProgram();
  const result = await query(projectOverviewSql);
  const projects = result.rows.map((row) => mapProjectSummary(row));
  const expected = projects.reduce((sum, project) => sum + project.callsExpected, 0);
  const completed = projects.reduce((sum, project) => sum + project.callsCompleted, 0);
  return {
    projects,
    totalProjects: projects.length,
    activeSites: projects.length,
    portfolioProgress: projects.length ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length) : 0,
    callsCompleted: completed,
    callsExpected: expected,
    openIssues: projects.reduce((sum, project) => sum + project.openIssues, 0),
    criticalIssues: projects.reduce((sum, project) => sum + project.criticalIssues, 0),
    reportsSent: projects.filter((project) => project.reportStatus === "sent").length,
    reportsExpected: projects.length,
    generatedAt: formatDateTime(new Date()) + " IST",
  };
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | undefined> {
  if (!hasDatabase()) return getDemoProject(projectId);
  const [program, projectResult, contactsResult, issuesResult, milestonesResult, callsResult, reportsResult, memoryResult, brainResult, sourceCountResult] = await Promise.all([
    getProgramOverview(),
    query(`SELECT *, GREATEST(0, CURRENT_DATE - start_date)::int AS working_days_elapsed FROM projects WHERE id = $1 AND active = true`, [projectId]),
    query(`SELECT *, (SELECT COUNT(*) FROM voice_calls vc WHERE vc.contact_id = c.id AND vc.status = 'completed' AND vc.completed_at > now() - interval '30 days')::int AS response_streak FROM project_contacts c WHERE project_id = $1 AND call_enabled ORDER BY priority, name`, [projectId]),
    query(`SELECT *, GREATEST(0, CURRENT_DATE - opened_at::date)::int AS age_days FROM issues WHERE project_id = $1 AND status <> 'resolved' ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, opened_at`, [projectId]),
    query(`SELECT * FROM milestones WHERE project_id = $1 ORDER BY planned_date`, [projectId]),
    query(`SELECT vc.*, c.name AS contact_name, c.role FROM voice_calls vc JOIN project_contacts c ON c.id = vc.contact_id WHERE vc.project_id = $1 AND vc.scheduled_for > now() - interval '2 days' ORDER BY vc.scheduled_for DESC`, [projectId]),
    query(`SELECT * FROM daily_reports WHERE project_id = $1 ORDER BY report_date DESC LIMIT 1`, [projectId]),
    query(`SELECT content FROM project_memory WHERE project_id = $1 AND status = 'active' ORDER BY importance DESC, last_observed_at DESC LIMIT 5`, [projectId]),
    query(`SELECT mf.*, COALESCE(sd.source_type, CASE WHEN mfe.conversation_id IS NOT NULL THEN 'voice' ELSE 'manual' END) AS source_type, COALESCE(sd.filename, mfe.conversation_id, 'Manual entry') AS source_label
      FROM memory_facts mf
      LEFT JOIN LATERAL (SELECT * FROM memory_fact_evidence WHERE fact_id = mf.id ORDER BY created_at DESC LIMIT 1) mfe ON true
      LEFT JOIN source_entries se ON se.id = mfe.source_entry_id
      LEFT JOIN source_documents sd ON sd.id = se.document_id
      WHERE mf.project_id = $1
      ORDER BY CASE mf.status WHEN 'active' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END, mf.importance DESC, mf.last_observed_at DESC LIMIT 30`, [projectId]),
    query(`SELECT source_type, COUNT(*)::int AS document_count, COALESCE(SUM(entry_count), 0)::int AS entry_count FROM source_documents WHERE project_id = $1 GROUP BY source_type`, [projectId]),
  ]);
  const summary = program.projects.find((project) => project.id === projectId);
  const row = projectResult.rows[0];
  if (!summary || !row) return undefined;

  const contacts: SiteContact[] = contactsResult.rows.map((contact) => ({
    id: text(contact.id), name: text(contact.name), role: text(contact.role),
    phoneMasked: maskPhone(text(contact.phone_e164)), initials: initials(text(contact.name)), callTime: text(contact.call_time).slice(0, 5),
    lastCallStatus: "scheduled", lastCallAt: "Scheduled", responseStreak: number(contact.response_streak),
  }));
  const calls: SiteCall[] = callsResult.rows.map((call) => ({
    id: text(call.id), contactName: text(call.contact_name), role: text(call.role), status: text(call.status, "scheduled") as SiteCall["status"],
    startedAt: formatDateTime(call.started_at), durationSeconds: number(call.duration_seconds), sentiment: normalizeSentiment(call.sentiment),
    summary: text(call.summary), transcript: Array.isArray(call.transcript) ? call.transcript as SiteCall["transcript"] : [],
    answers: mapAnswers(call.answers),
  }));
  for (const contact of contacts) {
    const call = calls.find((item) => item.contactName === contact.name);
    if (call) { contact.lastCallStatus = call.status; contact.lastCallAt = call.startedAt; }
  }
  const issues: Issue[] = issuesResult.rows.map((issue) => ({
    id: text(issue.id), title: text(issue.title), description: text(issue.description), category: text(issue.category, "approval") as Issue["category"],
    severity: text(issue.severity, "medium") as Issue["severity"], status: text(issue.status, "open") as Issue["status"], owner: text(issue.owner_name, "Unassigned"),
    raisedBy: text(issue.raised_by, "Voice agent"), raisedAt: formatDate(issue.opened_at, { day: "2-digit", month: "short", year: "numeric" }), dueDate: formatDate(issue.due_date, { day: "2-digit", month: "short", year: "numeric" }), ageDays: number(issue.age_days), impactedActivity: text(issue.impacted_activity),
  }));
  const milestones: Milestone[] = milestonesResult.rows.map((milestone) => ({
    id: text(milestone.id), name: text(milestone.name), plannedDate: formatDate(milestone.planned_date), forecastDate: formatDate(milestone.forecast_date), progress: Math.round(number(milestone.progress)), status: text(milestone.status, "on-track") as Milestone["status"],
  }));
  const reportRow = reportsResult.rows[0];
  const latestReport: DailyReport = reportRow ? mapDailyReport(reportRow) : emptyReport(projectId, contacts.length);
  const startProgress = Math.max(0, summary.progress - 25);
  return {
    ...summary,
    client: text(row.client_name), contractor: text(row.contractor_name), contractValue: text(row.contract_value), startDate: formatDate(row.start_date, { day: "2-digit", month: "short", year: "numeric" }), targetDate: formatDate(row.target_date, { day: "2-digit", month: "short", year: "numeric" }),
    workingDaysElapsed: number(row.working_days_elapsed), workingDaysTotal: number(row.working_days_total),
    weather: { condition: "Not connected", temperature: "—", impact: "Add a weather provider if required" },
    team: contacts, calls, issues, milestones, latestReport,
    progressHistory: Array.from({ length: 6 }, (_, index) => ({ label: formatDate(new Date(Date.now() - (5 - index) * 30 * 86400000), { month: "short" }), actual: Math.round(startProgress + index * ((summary.progress - startProgress) / 5)), planned: Math.round(startProgress + index * ((summary.plannedProgress - startProgress) / 5)) })),
    memory: memoryResult.rows.map((item) => text(item.content)),
    brain: brainResult.rows.map((fact): BrainFact => ({ id: text(fact.id), kind: text(fact.kind, "progress") as BrainFact["kind"], statement: text(fact.statement), owner: text(fact.owner_name) || undefined, dueDate: fact.due_date ? formatDate(fact.due_date) : undefined, status: text(fact.status, "active") as BrainFact["status"], confidence: Math.round(number(fact.confidence) * 100), observedAt: formatDateTime(fact.last_observed_at), sourceType: text(fact.source_type, "manual") as BrainFact["sourceType"], sourceLabel: text(fact.source_label, "Manual entry"), evidenceCount: number(fact.evidence_count, 1) })),
    sourceCounts: {
      voice: sourceCount(resultCount(sourceCountResult.rows, "voice", "document_count")),
      whatsapp: sourceCount(resultCount(sourceCountResult.rows, "whatsapp", "entry_count")),
      dpr: sourceCount(resultCount(sourceCountResult.rows, "dpr", "document_count")),
    },
  };
}

export async function listDispatchTargets(options: { projectId?: string; contactId?: string; dueOnly?: boolean; at?: Date } = {}): Promise<DispatchTarget[]> {
  if (!hasDatabase()) {
    const details = options.projectId ? [getDemoProject(options.projectId)].filter(Boolean) as ProjectDetail[] : getAllDemoProjects();
    return details.flatMap((project) => project.team.filter((person) => !options.contactId || person.id === options.contactId).map((person) => ({
      contactId: person.id, projectId: project.id, projectCode: project.code, projectName: project.name, projectLocation: project.location, timezone: "Asia/Kolkata", contactName: person.name, contactRole: person.role, phoneE164: null, preferredLanguage: "en-hi", reportRecipients: project.latestReport.recipients,
    })));
  }
  const values: unknown[] = [options.at ?? new Date()];
  let conditions = `p.active AND c.call_enabled AND c.phone_e164 IS NOT NULL`;
  if (options.projectId) { values.push(options.projectId); conditions += ` AND p.id = $${values.length}`; }
  if (options.contactId) { values.push(options.contactId); conditions += ` AND c.id = $${values.length}`; }
  if (options.dueOnly) conditions += `
    AND EXTRACT(ISODOW FROM ($1::timestamptz AT TIME ZONE p.timezone))::int = ANY(c.call_days)
    AND ($1::timestamptz AT TIME ZONE p.timezone)::time >= c.call_time
    AND ($1::timestamptz AT TIME ZONE p.timezone)::time < c.call_time + interval '15 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM voice_calls vc WHERE vc.contact_id = c.id
        AND (vc.scheduled_for AT TIME ZONE p.timezone)::date = ($1::timestamptz AT TIME ZONE p.timezone)::date
        AND vc.status IN ('scheduled', 'in-progress', 'completed')
    )`;
  const result = await query(`SELECT c.id AS contact_id, c.name AS contact_name, c.role AS contact_role, c.phone_e164, c.preferred_language, p.id AS project_id, p.code AS project_code, p.name AS project_name, p.location AS project_location, p.timezone, p.report_recipients FROM project_contacts c JOIN projects p ON p.id = c.project_id WHERE ${conditions} ORDER BY c.priority, c.name`, values);
  return result.rows.map((row) => ({ contactId: text(row.contact_id), projectId: text(row.project_id), projectCode: text(row.project_code), projectName: text(row.project_name), projectLocation: text(row.project_location), timezone: text(row.timezone, "Asia/Kolkata"), contactName: text(row.contact_name), contactRole: text(row.contact_role), phoneE164: text(row.phone_e164) || null, preferredLanguage: text(row.preferred_language, "en-hi"), reportRecipients: strings(row.report_recipients) }));
}

export async function getVoiceContext(target: DispatchTarget, at = new Date()): Promise<VoiceContext> {
  const reportDate = new Intl.DateTimeFormat("en-CA", { timeZone: target.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  if (!hasDatabase()) {
    const project = getDemoProject(target.projectId);
    return { reportDate, previousContext: project?.memory.join(" ") || "No earlier context.", openIssues: project?.issues.map((issue) => `${issue.title} — owner ${issue.owner}, due ${issue.dueDate}`).join("; ") || "No open issues.", milestones: project?.milestones.filter((item) => item.status !== "complete").map((item) => `${item.name}: forecast ${item.forecastDate}`).join("; ") || "No open milestones." };
  }
  const [memory, issues, milestones, priorCall] = await Promise.all([
    query(`SELECT statement AS content FROM memory_facts WHERE project_id = $1 AND status = 'active' ORDER BY importance DESC, last_observed_at DESC LIMIT 8`, [target.projectId]),
    query(`SELECT title, owner_name, due_date FROM issues WHERE project_id = $1 AND status <> 'resolved' AND (owner_name = $2 OR severity IN ('critical','high')) ORDER BY severity, due_date NULLS LAST LIMIT 6`, [target.projectId, target.contactName]),
    query(`SELECT name, forecast_date, status FROM milestones WHERE project_id = $1 AND status <> 'complete' ORDER BY forecast_date LIMIT 4`, [target.projectId]),
    query(`SELECT summary, answers FROM voice_calls WHERE contact_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`, [target.contactId]),
  ]);
  const previous = [...memory.rows.map((row) => text(row.content)), ...priorCall.rows.map((row) => text(row.summary))].filter(Boolean).join(" ");
  return { reportDate, previousContext: previous || "No earlier context is available.", openIssues: issues.rows.map((row) => `${text(row.title)} — owner ${text(row.owner_name)}, due ${formatDate(row.due_date)}`).join("; ") || "No open issue is assigned to this contact.", milestones: milestones.rows.map((row) => `${text(row.name)} — forecast ${formatDate(row.forecast_date)}`).join("; ") || "No milestone follow-up is due." };
}

export async function recordCallDispatch(target: DispatchTarget, conversationId: string | null, providerCallId: string | null, scheduledFor = new Date()) {
  if (!hasDatabase()) return;
  await query(`
    WITH next_attempt AS (
      SELECT COALESCE(MAX(attempt), 0) + 1 AS attempt FROM voice_calls
      WHERE project_id = $1 AND contact_id = $2 AND (scheduled_for AT TIME ZONE $3)::date = ($4::timestamptz AT TIME ZONE $3)::date
    )
    INSERT INTO voice_calls (project_id, contact_id, conversation_id, provider_call_id, scheduled_for, status, attempt)
    SELECT $1, $2, $5, $6, $4, 'scheduled', attempt FROM next_attempt`,
    [target.projectId, target.contactId, target.timezone, scheduledFor, conversationId, providerCallId],
  );
}

export async function recordWebhookReceipt(eventKey: string, eventType: string, payloadSha256: string): Promise<boolean> {
  if (!hasDatabase()) return true;
  const result = await query(`INSERT INTO webhook_receipts (provider, event_key, event_type, payload_sha256) VALUES ('elevenlabs', $1, $2, $3) ON CONFLICT (provider, event_key) DO NOTHING RETURNING id`, [eventKey, eventType, payloadSha256]);
  return result.rowCount === 1;
}

export async function markWebhookProcessed(eventKey: string, error?: string) {
  if (!hasDatabase()) return;
  await query(`UPDATE webhook_receipts SET processed_at = now(), processing_error = $2 WHERE provider = 'elevenlabs' AND event_key = $1`, [eventKey, error ?? null]);
}

export async function ingestVoiceCall(call: IngestedVoiceCall) {
  if (!hasDatabase()) return;
  await query(`
    INSERT INTO voice_calls (project_id, contact_id, conversation_id, scheduled_for, started_at, completed_at, status, duration_seconds, language, sentiment, summary, transcript, answers, analysis, metadata)
    VALUES ($1,$2,$3,$4,$4,$5,'completed',$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb)
    ON CONFLICT (conversation_id) DO UPDATE SET completed_at = EXCLUDED.completed_at, status = 'completed', duration_seconds = EXCLUDED.duration_seconds, language = EXCLUDED.language, sentiment = EXCLUDED.sentiment, summary = EXCLUDED.summary, transcript = EXCLUDED.transcript, answers = EXCLUDED.answers, analysis = EXCLUDED.analysis, metadata = EXCLUDED.metadata`,
    [call.projectId, call.contactId, call.conversationId, call.startedAt, call.completedAt, call.durationSeconds, call.language ?? null, call.sentiment ?? null, call.summary, JSON.stringify(call.transcript), JSON.stringify(call.answers), JSON.stringify(call.analysis), JSON.stringify(call.metadata)],
  );
}

export async function getCompletedCallsForReport(projectId: string, reportDate: string) {
  if (!hasDatabase()) return [] as Array<{ conversationId: string; answers: Record<string, string>; summary: string }>;
  const result = await query(`SELECT vc.conversation_id, vc.answers, vc.summary FROM voice_calls vc JOIN projects p ON p.id = vc.project_id WHERE vc.project_id = $1 AND vc.status = 'completed' AND (vc.completed_at AT TIME ZONE p.timezone)::date = $2::date ORDER BY vc.completed_at`, [projectId, reportDate]);
  return result.rows.map((row) => ({ conversationId: text(row.conversation_id), answers: (row.answers && typeof row.answers === "object" ? row.answers : {}) as Record<string, string>, summary: text(row.summary) }));
}

export async function getReportProject(projectId: string) {
  if (!hasDatabase()) {
    const project = getDemoProject(projectId);
    return project ? { id: project.id, name: project.name, code: project.code, recipients: project.latestReport.recipients, expectedCalls: project.team.length } : undefined;
  }
  const result = await query(`SELECT p.id, p.name, p.code, p.report_recipients, COUNT(c.id) FILTER (WHERE c.call_enabled)::int AS expected_calls FROM projects p LEFT JOIN project_contacts c ON c.project_id = p.id WHERE p.id = $1 GROUP BY p.id`, [projectId]);
  const row = result.rows[0];
  return row ? { id: text(row.id), name: text(row.name), code: text(row.code), recipients: strings(row.report_recipients), expectedCalls: number(row.expected_calls) } : undefined;
}

export async function upsertDailyReport(report: DailyReport) {
  if (!hasDatabase()) return report;
  await query(`INSERT INTO daily_reports (id, project_id, report_date, status, executive_summary, work_completed, planned_tomorrow, blockers, safety_notes, manpower, weather, calls_included, calls_expected, recipients, source_conversation_ids, generated_at)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,now())
    ON CONFLICT (project_id, report_date) DO UPDATE SET status = EXCLUDED.status, executive_summary = EXCLUDED.executive_summary, work_completed = EXCLUDED.work_completed, planned_tomorrow = EXCLUDED.planned_tomorrow, blockers = EXCLUDED.blockers, safety_notes = EXCLUDED.safety_notes, manpower = EXCLUDED.manpower, calls_included = EXCLUDED.calls_included, calls_expected = EXCLUDED.calls_expected, recipients = EXCLUDED.recipients, source_conversation_ids = EXCLUDED.source_conversation_ids, generated_at = now(), version = daily_reports.version + 1`,
    [report.id, report.projectId, report.date, report.status === "sent" ? "sent" : "draft", report.executiveSummary, JSON.stringify(report.workCompleted), JSON.stringify(report.plannedTomorrow), JSON.stringify(report.blockers), JSON.stringify(report.safetyNotes), report.manpower, report.weather, report.callsIncluded, report.callsExpected, report.recipients, report.sourceConversationIds ?? []],
  );
  return report;
}

export async function getDailyReportById(reportId: string): Promise<(DailyReport & { projectName: string; projectCode: string }) | undefined> {
  if (!hasDatabase()) {
    const project = getAllDemoProjects().find((item) => item.latestReport.id === reportId);
    return project ? { ...project.latestReport, projectName: project.name, projectCode: project.code } : undefined;
  }
  const result = await query(`SELECT dr.*, p.name AS project_name, p.code AS project_code FROM daily_reports dr JOIN projects p ON p.id = dr.project_id WHERE dr.id = $1`, [reportId]);
  const row = result.rows[0];
  return row ? { ...mapDailyReport(row), projectName: text(row.project_name), projectCode: text(row.project_code) } : undefined;
}

export async function markReportSent(reportId: string, providerId: string) {
  if (!hasDatabase()) return;
  await query(`UPDATE daily_reports SET status = 'sent', sent_at = now(), email_provider_id = $2 WHERE id = $1`, [reportId, providerId]);
}

function mapDailyReport(row: Record<string, unknown>): DailyReport {
  return { id: text(row.id), projectId: text(row.project_id), date: formatDate(row.report_date, { day: "2-digit", month: "long", year: "numeric" }), status: row.status === "sent" ? "sent" : "draft", sentAt: row.sent_at ? formatDateTime(row.sent_at) : undefined, recipients: strings(row.recipients), executiveSummary: text(row.executive_summary), workCompleted: strings(row.work_completed), plannedTomorrow: strings(row.planned_tomorrow), blockers: strings(row.blockers), safetyNotes: strings(row.safety_notes), manpower: number(row.manpower), callsIncluded: number(row.calls_included), callsExpected: number(row.calls_expected), sourceConversationIds: strings(row.source_conversation_ids), weather: text(row.weather) };
}

function emptyReport(projectId: string, expectedCalls: number): DailyReport {
  return { id: `dpr-${projectId}-${new Date().toISOString().slice(0, 10)}`, projectId, date: formatDate(new Date(), { day: "2-digit", month: "long", year: "numeric" }), status: "draft", recipients: [], executiveSummary: "The daily report will appear after the first completed call is processed.", workCompleted: [], plannedTomorrow: [], blockers: [], safetyNotes: [], manpower: 0, callsIncluded: 0, callsExpected: expectedCalls, weather: "" };
}

function normalizeSentiment(value: unknown): SiteCall["sentiment"] {
  const normalized = text(value).toLowerCase();
  if (normalized.includes("positive")) return "positive";
  if (normalized.includes("negative") || normalized.includes("concern")) return "concerned";
  return "neutral";
}

function mapAnswers(value: unknown): SiteCall["answers"] {
  const answers = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return { completed: text(answers.work_completed ?? answers.completed), challenges: text(answers.challenges), tomorrow: text(answers.tomorrow_plan ?? answers.tomorrow), blockers: text(answers.blockers), safety: text(answers.safety) };
}

function initials(name: string) { return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function maskPhone(phone: string) { return phone ? `${phone.slice(0, 3)} ••••• ${phone.slice(-4)}` : "Number pending"; }
function resultCount(rows: Record<string, unknown>[], type: string, field: "document_count" | "entry_count") { return rows.find((row) => row.source_type === type)?.[field]; }
function sourceCount(value: unknown) { return number(value); }

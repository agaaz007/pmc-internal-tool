export type ProjectStatus = "on-track" | "watch" | "at-risk";
export type ProjectPhase = "Mobilisation" | "Structure" | "MEP" | "Finishes" | "Handover";
export type IssueSeverity = "critical" | "high" | "medium" | "low";
export type IssueStatus = "open" | "monitoring" | "resolved";
export type CallStatus = "completed" | "in-progress" | "scheduled" | "missed" | "failed";

export interface ProjectSummary {
  id: string;
  code: string;
  name: string;
  location: string;
  region: string;
  phase: ProjectPhase;
  status: ProjectStatus;
  progress: number;
  plannedProgress: number;
  openIssues: number;
  criticalIssues: number;
  callsCompleted: number;
  callsExpected: number;
  reportStatus: "sent" | "drafting" | "awaiting-calls";
  updatedAt: string;
  manager: string;
  nextMilestone: string;
  nextMilestoneDate: string;
  accent: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: "material" | "design" | "safety" | "labour" | "equipment" | "approval";
  severity: IssueSeverity;
  status: IssueStatus;
  owner: string;
  raisedBy: string;
  raisedAt: string;
  dueDate: string;
  ageDays: number;
  impactedActivity: string;
}

export interface SiteContact {
  id: string;
  name: string;
  role: string;
  phoneMasked: string;
  initials: string;
  callTime: string;
  lastCallStatus: CallStatus;
  lastCallAt: string;
  responseStreak: number;
}

export interface SiteCall {
  id: string;
  contactName: string;
  role: string;
  status: CallStatus;
  startedAt: string;
  durationSeconds: number;
  sentiment: "positive" | "neutral" | "concerned";
  summary: string;
  transcript: Array<{ role: "agent" | "user"; message: string; at: string }>;
  answers: {
    completed: string;
    challenges: string;
    tomorrow: string;
    blockers: string;
    safety: string;
  };
}

export interface DailyReport {
  id: string;
  projectId: string;
  date: string;
  status: "sent" | "draft";
  sentAt?: string;
  recipients: string[];
  executiveSummary: string;
  workCompleted: string[];
  plannedTomorrow: string[];
  blockers: string[];
  safetyNotes: string[];
  manpower: number;
  callsIncluded: number;
  callsExpected: number;
  sourceConversationIds?: string[];
  weather: string;
}

export interface Milestone {
  id: string;
  name: string;
  plannedDate: string;
  forecastDate: string;
  progress: number;
  status: "complete" | "on-track" | "watch";
}

export interface BrainFact {
  id: string;
  kind: "progress" | "issue" | "decision" | "commitment" | "risk" | "safety" | "material" | "milestone";
  statement: string;
  owner?: string;
  dueDate?: string;
  status: "active" | "resolved" | "superseded";
  confidence: number;
  observedAt: string;
  sourceType: "voice" | "whatsapp" | "dpr" | "manual";
  sourceLabel: string;
  evidenceCount: number;
}

export interface ProjectDetail extends ProjectSummary {
  client: string;
  contractor: string;
  contractValue: string;
  startDate: string;
  targetDate: string;
  workingDaysElapsed: number;
  workingDaysTotal: number;
  weather: { condition: string; temperature: string; impact: string };
  team: SiteContact[];
  calls: SiteCall[];
  issues: Issue[];
  milestones: Milestone[];
  latestReport: DailyReport;
  progressHistory: Array<{ label: string; actual: number; planned: number }>;
  memory: string[];
  brain: BrainFact[];
  sourceCounts: { voice: number; whatsapp: number; dpr: number };
}

export interface ProgramOverview {
  projects: ProjectSummary[];
  totalProjects: number;
  activeSites: number;
  portfolioProgress: number;
  callsCompleted: number;
  callsExpected: number;
  openIssues: number;
  criticalIssues: number;
  reportsSent: number;
  reportsExpected: number;
  generatedAt: string;
}

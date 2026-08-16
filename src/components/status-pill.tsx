import type { CallStatus, IssueSeverity, ProjectStatus } from "@/lib/types";

const labels: Record<string, string> = {
  "on-track": "On track",
  watch: "Needs attention",
  "at-risk": "At risk",
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  completed: "Completed",
  "in-progress": "In progress",
  scheduled: "Scheduled",
  missed: "Missed",
  failed: "Failed",
  sent: "Sent",
  drafting: "Drafting",
  "awaiting-calls": "Awaiting calls",
};

export function StatusPill({ status }: { status: ProjectStatus | IssueSeverity | CallStatus | "sent" | "drafting" | "awaiting-calls" }) {
  return <span className={`status-pill status-${status}`}><i />{labels[status] ?? status}</span>;
}

import assert from "node:assert/strict";
import test from "node:test";
import { composeDailyReport } from "../src/lib/reporting";

test("composes a deduplicated DPR from multiple calls", () => {
  const project = { id: "mh", name: "Meridian Heights", code: "MH-042", recipients: ["ops@example.com"], expectedCalls: 2 };
  const report = composeDailyReport(project, "2026-08-17", [
    { conversationId: "c1", summary: "", answers: { work_completed: "L26 reinforcement complete", tomorrow_plan: "Pour L26 slab", blockers: "180 brackets pending", challenges: "None", safety: "No incidents", manpower: "184 workers" } },
    { conversationId: "c2", summary: "", answers: { work_completed: "L26 reinforcement complete", tomorrow_plan: "Close MEP punch points", blockers: "RFI-118 pending", challenges: "N/A", safety: "Zero incidents", manpower: "42 people" } },
  ]);
  assert.deepEqual(report.workCompleted, ["L26 reinforcement complete"]);
  assert.deepEqual(report.blockers, ["180 brackets pending", "RFI-118 pending"]);
  assert.equal(report.manpower, 184);
  assert.equal(report.callsIncluded, 2);
  assert.match(report.executiveSummary, /2 of 2 scheduled/);
});

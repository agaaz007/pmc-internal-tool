"use client";

import Link from "next/link";
import { useState } from "react";
import type { BrainFact, Issue, ProjectDetail as ProjectDetailType, SiteCall } from "@/lib/types";
import { Icon, type IconName } from "./icons";
import { ProgressRing } from "./progress-ring";
import { StatusPill } from "./status-pill";

type Tab = "overview" | "brief" | "issues" | "calls" | "brain";

export function ProjectDetail({ project }: { project: ProjectDetailType }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedCall, setSelectedCall] = useState<SiteCall | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3400);
  }

  async function callTeam() {
    setDispatching(true);
    try {
      const response = await fetch("/api/calls/dispatch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const result = await response.json() as { dispatched?: number; simulated?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Call dispatch failed");
      notify(result.simulated ? `Demo: ${result.dispatched ?? project.team.length} calls simulated. Add credentials to place real calls.` : `${result.dispatched} calls dispatched to the site team.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Call dispatch failed");
    } finally {
      setDispatching(false);
    }
  }

  return (
    <div className="page-wrap project-page page-enter">
      <div className="breadcrumb"><Link href="/">Projects</Link><Icon name="chevron" size={13}/><span>{project.code}</span></div>

      <section className="project-hero">
        <div className="project-hero-copy">
          <div className="project-title-line"><span className="large-monogram" style={{ background: project.accent }}>{project.code.slice(0, 2)}</span><div><span className="eyebrow">{project.code} · {project.phase}</span><h1>{project.name}</h1><p>{project.location} <i/> Project manager: {project.manager}</p></div></div>
        </div>
        <div className="project-hero-actions">
          <StatusPill status={project.status}/>
          <button className="secondary-button" onClick={() => window.print()}><Icon name="download" size={16}/> Export DPR</button>
          <button className="primary-button group" onClick={callTeam} disabled={dispatching}><span>{dispatching ? "Starting calls…" : "Call site team"}</span><span className="button-orb"><Icon name="phone" size={15}/></span></button>
        </div>
      </section>

      <section className="project-facts">
        <div className="project-fact-progress"><ProgressRing value={project.progress} size={72} stroke={6} color={project.accent}/><div><small>Physical progress</small><strong>{project.progress >= project.plannedProgress ? `${project.progress - project.plannedProgress}% ahead of plan` : `${project.plannedProgress - project.progress}% behind plan`}</strong><span>Baseline {project.plannedProgress}%</span></div></div>
        <Fact label="Contract value" value={project.contractValue}/>
        <Fact label="Target handover" value={project.targetDate}/>
        <Fact label="Time elapsed" value={`${project.workingDaysElapsed} / ${project.workingDaysTotal} days`}/>
        <Fact label="Today’s weather" value={`${project.weather.condition} · ${project.weather.temperature}`} sub={project.weather.impact}/>
      </section>

      <div className="tab-bar" role="tablist" aria-label="Project sections">
        {(["overview", "brief", "issues", "calls", "brain"] as Tab[]).map((item) => (
          <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? "selected" : ""} onClick={() => setTab(item)}>
            {item === "overview" ? "Command view" : item === "brief" ? "Daily brief" : item === "issues" ? `Issues · ${project.issues.length}` : item === "calls" ? `Voice calls · ${project.calls.length}` : `Company brain · ${project.brain.length}`}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab project={project} onCall={setSelectedCall} onNavigate={setTab}/>}
      {tab === "brief" && <BriefTab project={project} onNotify={notify}/>}
      {tab === "issues" && <IssuesTab issues={project.issues}/>}
      {tab === "calls" && <CallsTab project={project} onCall={setSelectedCall} onDispatch={callTeam} dispatching={dispatching}/>}
      {tab === "brain" && <BrainTab project={project} onNotify={notify}/>}

      {selectedCall && <CallDrawer call={selectedCall} onClose={() => setSelectedCall(null)}/>}
      {toast && <div className="toast" role="status"><Icon name="check" size={16}/><span>{toast}</span></div>}
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="project-fact"><small>{label}</small><strong>{value}</strong>{sub && <span>{sub}</span>}</div>;
}

function OverviewTab({ project, onCall, onNavigate }: { project: ProjectDetailType; onCall: (call: SiteCall) => void; onNavigate: (tab: Tab) => void }) {
  return (
    <div className="detail-grid">
      <section className="double-shell report-summary-shell">
        <div className="panel-core report-summary">
          <div className="panel-heading report-heading"><div><span className="eyebrow">AI daily brief · {project.latestReport.date}</span><h2>Executive summary</h2></div><StatusPill status="sent"/></div>
          <p className="executive-copy">{project.latestReport.executiveSummary}</p>
          <div className="report-columns">
            <ReportList title="Completed today" icon="check" items={project.latestReport.workCompleted.slice(0, 3)}/>
            <ReportList title="Tomorrow’s priorities" icon="calendar" items={project.latestReport.plannedTomorrow}/>
          </div>
          <div className="report-alert"><span><Icon name="alert" size={18}/></span><div><strong>Primary exposure</strong><p>{project.latestReport.blockers[0]}</p></div></div>
          <button className="text-link standalone-link" onClick={() => onNavigate("brief")}>Open complete daily report <span><Icon name="arrow" size={15}/></span></button>
        </div>
      </section>

      <section className="double-shell chart-shell">
        <div className="panel-core">
          <div className="panel-heading"><div><span className="eyebrow">Schedule control</span><h2>Progress curve</h2></div><span className="variance-good">+{project.progress - project.plannedProgress}%</span></div>
          <ProgressChart history={project.progressHistory} accent={project.accent}/>
          <div className="chart-legend"><span><i style={{ background: project.accent }}/>Actual</span><span><i className="planned-line"/>Planned</span></div>
        </div>
      </section>

      <section className="double-shell issues-shell">
        <div className="panel-core">
          <div className="panel-heading"><div><span className="eyebrow">Action register</span><h2>Open issues</h2></div><button className="quiet-button" onClick={() => onNavigate("issues")}>View all <Icon name="arrow" size={13}/></button></div>
          <div className="issue-preview-list">{project.issues.map((issue) => <IssuePreview key={issue.id} issue={issue}/>)}</div>
        </div>
      </section>

      <section className="double-shell calls-shell">
        <div className="panel-core">
          <div className="panel-heading"><div><span className="eyebrow">Field evidence</span><h2>Today’s voices</h2></div><span className="call-complete-mark"><Icon name="check" size={14}/>{project.calls.length}/{project.team.length}</span></div>
          <div className="voice-list">{project.calls.slice(0, 4).map((call) => <button key={call.id} onClick={() => onCall(call)}><span className="voice-avatar">{initials(call.contactName)}</span><span><strong>{call.contactName}</strong><small>{call.role} · {formatDuration(call.durationSeconds)}</small></span><i className={`sentiment-${call.sentiment}`}/><Icon name="play" size={15}/></button>)}</div>
          <button className="secondary-button full-button" onClick={() => onNavigate("calls")}>Review all conversations</button>
        </div>
      </section>

      <section className="double-shell milestone-shell">
        <div className="panel-core">
          <div className="panel-heading"><div><span className="eyebrow">Delivery plan</span><h2>Milestones</h2></div><span className="muted-note">Forecast vs baseline</span></div>
          <div className="milestone-list">{project.milestones.map((milestone) => <div className="milestone-row" key={milestone.id}><span className={`milestone-node milestone-${milestone.status}`}><Icon name={milestone.status === "complete" ? "check" : "clock"} size={13}/></span><div><strong>{milestone.name}</strong><small>{milestone.progress}% complete</small></div><span><small>Baseline</small><b>{milestone.plannedDate}</b></span><span><small>Forecast</small><b className={milestone.status === "watch" ? "danger-text" : ""}>{milestone.forecastDate}</b></span></div>)}</div>
        </div>
      </section>

      <section className="double-shell memory-shell">
        <div className="panel-core memory-core">
          <div className="panel-heading"><div><span className="eyebrow">Compounding context</span><h2>What FieldBrief remembers</h2></div><span className="ai-mark"><Icon name="spark" size={16}/></span></div>
          <p>These observations are carried into tomorrow’s calls, so the agent follows up instead of asking from scratch.</p>
          <ol>{project.memory.map((item, index) => <li key={item}><span>0{index + 1}</span><p>{item}</p></li>)}</ol>
          <button className="secondary-button full-button memory-button" onClick={() => onNavigate("brain")}><Icon name="upload" size={15}/> Import WhatsApp & open brain</button>
        </div>
      </section>
    </div>
  );
}

function BrainTab({ project, onNotify }: { project: ProjectDetailType; onNotify: (message: string) => void }) {
  const [kind, setKind] = useState<"all" | BrainFact["kind"]>("all");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [importedFacts, setImportedFacts] = useState<Array<Pick<BrainFact, "kind" | "statement" | "owner" | "dueDate">>>([]);
  const facts = project.brain.filter((fact) => kind === "all" || fact.kind === kind);
  const activeCount = project.brain.filter((fact) => fact.status === "active").length;
  const evidence = project.brain.reduce((sum, fact) => sum + fact.evidenceCount, 0);

  async function upload() {
    if (!file) return onNotify("Choose a WhatsApp .txt export first.");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/projects/${project.id}/whatsapp`, { method: "POST", body: form });
      const result = await response.json() as { messagesImported?: number; factsExtracted?: number; duplicate?: boolean; simulated?: boolean; preview?: Array<Pick<BrainFact, "kind" | "statement" | "owner" | "dueDate">>; error?: string };
      if (!response.ok) throw new Error(result.error || "Import failed");
      setImportedFacts(result.preview ?? []);
      onNotify(result.duplicate ? "This exact chat export was already imported—nothing was duplicated." : `${result.messagesImported} messages parsed and ${result.factsExtracted} memory facts ${result.simulated ? "previewed" : "added"}.`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "Import failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="brain-layout">
      <section className="brain-heading">
        <div><span className="eyebrow">Evidence-backed project memory</span><h2>The company brain for {project.name}</h2><p>Every fact retains its source, observation date, confidence and history. Newer evidence can resolve or supersede older facts without erasing it.</p></div>
        <div className="brain-stats"><div><small>Active facts</small><strong>{activeCount}</strong></div><div><small>Evidence links</small><strong>{evidence}</strong></div><div><small>WhatsApp messages</small><strong>{project.sourceCounts.whatsapp.toLocaleString("en-IN")}</strong></div></div>
      </section>

      <section className="double-shell import-shell">
        <div className="import-core">
          <span className="import-icon"><Icon name="upload" size={22}/></span>
          <div><span className="eyebrow">Bring existing site context in</span><h3>Import a WhatsApp group export</h3><p>In WhatsApp, choose <b>Export chat → Without media</b>, then upload the `.txt` file. Android and iPhone formats are supported.</p></div>
          <label className="file-picker"><input type="file" accept=".txt,text/plain" onChange={(event) => setFile(event.target.files?.[0] ?? null)}/><span>{file ? file.name : "Choose .txt file"}</span><i><Icon name="upload" size={14}/></i></label>
          <button className="primary-button group" onClick={upload} disabled={uploading || !file}><span>{uploading ? "Building memory…" : "Import chat"}</span><span className="button-orb"><Icon name="spark" size={14}/></span></button>
        </div>
      </section>

      {importedFacts.length > 0 && <section className="import-preview"><div><Icon name="check" size={16}/><span><strong>Import preview ready</strong><small>These are the first facts found in the uploaded chat.</small></span></div><div className="import-fact-grid">{importedFacts.map((fact, index) => <article key={`${fact.kind}-${index}`}><span className={`fact-kind kind-${fact.kind}`}>{fact.kind}</span><p>{fact.statement}</p>{fact.owner && <small>{fact.owner}{fact.dueDate ? ` · due ${fact.dueDate}` : ""}</small>}</article>)}</div></section>}

      <section className="double-shell brain-feed-shell">
        <div className="panel-core">
          <div className="panel-heading brain-feed-heading"><div><span className="eyebrow">Current knowledge</span><h2>Project memory ledger</h2></div><div className="brain-filter"><button className={kind === "all" ? "selected" : ""} onClick={() => setKind("all")}>All</button>{(["risk", "commitment", "decision", "progress", "safety"] as BrainFact["kind"][]).map((item) => <button key={item} className={kind === item ? "selected" : ""} onClick={() => setKind(item)}>{item}</button>)}</div></div>
          <div className="fact-ledger">{facts.map((fact) => <article key={fact.id} className={fact.status !== "active" ? "fact-inactive" : ""}><span className={`fact-kind kind-${fact.kind}`}>{fact.kind}</span><div className="fact-statement"><strong>{fact.statement}</strong><span>{fact.owner && <><b>{fact.owner}</b><i/></>}{fact.dueDate && <>Due {fact.dueDate}<i/></>}{fact.observedAt}</span></div><div className="fact-evidence"><span><Icon name={fact.sourceType === "whatsapp" ? "phone" : fact.sourceType === "voice" ? "phone" : "report"} size={13}/>{fact.sourceLabel}</span><small>{fact.evidenceCount} evidence link{fact.evidenceCount === 1 ? "" : "s"}</small></div><div className="confidence"><span><i style={{ transform: `scaleX(${fact.confidence / 100})` }}/></span><small>{fact.confidence}% confidence</small></div><span className={`fact-status fact-${fact.status}`}>{fact.status}</span></article>)}</div>
        </div>
      </section>

      <aside className="brain-method"><Icon name="spark" size={17}/><div><strong>How memory compounds</strong><p>New calls receive the highest-priority active facts. Exact sources remain immutable; contradictions create a newer fact and mark the old one superseded after confirmation.</p></div></aside>
    </div>
  );
}

function ProgressChart({ history, accent }: { history: ProjectDetailType["progressHistory"]; accent: string }) {
  const width = 560;
  const height = 210;
  const pad = 24;
  const toPoints = (key: "actual" | "planned") => history.map((item, index) => {
    const x = pad + (index * (width - pad * 2)) / (history.length - 1);
    const y = height - pad - ((item[key] - 30) / 45) * (height - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Actual versus planned progress from March to August">
        {[0, 1, 2, 3].map((line) => <line key={line} x1={pad} x2={width - pad} y1={pad + line * 48} y2={pad + line * 48} className="chart-gridline"/>)}
        <polyline points={toPoints("planned")} className="chart-planned"/>
        <polyline points={toPoints("actual")} className="chart-actual" style={{ stroke: accent }}/>
        {history.map((item, index) => {
          const [x, y] = toPoints("actual").split(" ")[index].split(",");
          return <circle key={item.label} cx={x} cy={y} r="4" fill="#f7f3eb" stroke={accent} strokeWidth="2.5"/>;
        })}
      </svg>
      <div className="chart-labels">{history.map((item) => <span key={item.label}>{item.label}</span>)}</div>
    </div>
  );
}

function ReportList({ title, icon, items }: { title: string; icon: IconName; items: string[] }) {
  return <div className="report-list"><strong><Icon name={icon} size={16}/>{title}</strong><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div>;
}

function IssuePreview({ issue }: { issue: Issue }) {
  return <div className="issue-preview"><span className={`severity-mark severity-${issue.severity}`}/><div><strong>{issue.title}</strong><small>{issue.impactedActivity}</small></div><span className="issue-owner">{initials(issue.owner)}</span><span className="issue-age">{issue.ageDays === 0 ? "Today" : `${issue.ageDays}d`}</span></div>;
}

function BriefTab({ project, onNotify }: { project: ProjectDetailType; onNotify: (message: string) => void }) {
  const report = project.latestReport;
  async function sendReport() {
    const response = await fetch(`/api/reports/${report.id}/send`, { method: "POST" });
    const result = await response.json() as { simulated?: boolean; error?: string };
    if (!response.ok) return onNotify(result.error ?? "Report delivery failed");
    onNotify(result.simulated ? "Demo: email preview generated. Add Resend credentials to deliver it." : `DPR sent to ${report.recipients.length} recipients.`);
  }
  return (
    <section className="dpr-document double-shell">
      <div className="dpr-paper">
        <header className="dpr-header"><div><span className="brand compact-brand"><span className="brand-mark"><span /></span><span className="brand-word">FieldBrief</span></span><small>Daily progress report</small></div><div><strong>{project.name}</strong><span>{report.date}</span></div></header>
        <div className="dpr-title"><span className="eyebrow">{project.code} · Generated from {report.callsIncluded} verified calls</span><h2>Daily progress report</h2><p>{report.executiveSummary}</p></div>
        <div className="dpr-kpis"><div><small>Physical progress</small><strong>{project.progress}%</strong><span>Plan {project.plannedProgress}%</span></div><div><small>Manpower</small><strong>{report.manpower}</strong><span>on site today</span></div><div><small>Safety</small><strong>Zero</strong><span>incidents</span></div><div><small>Weather</small><strong>{project.weather.temperature}</strong><span>{report.weather}</span></div></div>
        <div className="dpr-sections"><ReportList title="Work completed" icon="check" items={report.workCompleted}/><ReportList title="Plan for tomorrow" icon="calendar" items={report.plannedTomorrow}/><ReportList title="Blockers & decisions needed" icon="alert" items={report.blockers}/><ReportList title="Safety observations" icon="users" items={report.safetyNotes}/></div>
        <footer className="dpr-footer"><div><small>Distribution</small><span>{report.recipients.join(" · ")}</span></div><div className="dpr-actions"><button className="secondary-button" onClick={() => window.print()}><Icon name="download" size={15}/> Download PDF</button><button className="primary-button group" onClick={sendReport}><span>Send report</span><span className="button-orb"><Icon name="send" size={14}/></span></button></div></footer>
      </div>
    </section>
  );
}

function IssuesTab({ issues }: { issues: Issue[] }) {
  return (
    <section className="issues-table-shell double-shell">
      <div className="panel-core">
        <div className="panel-heading"><div><span className="eyebrow">Live action register</span><h2>Issues & blockers</h2></div><button className="secondary-button"><Icon name="download" size={15}/> Export register</button></div>
        <div className="issues-table">
          <div className="issues-table-head"><span>Issue</span><span>Severity</span><span>Owner</span><span>Due</span><span>Status</span></div>
          {issues.map((issue) => <article key={issue.id}><div className="issue-main"><span className={`category-icon category-${issue.category}`}><Icon name="alert" size={15}/></span><div><strong>{issue.title}</strong><p>{issue.description}</p><small>{issue.impactedActivity} · Raised by {issue.raisedBy}</small></div></div><StatusPill status={issue.severity}/><span className="owner-cell"><i>{initials(issue.owner)}</i>{issue.owner}</span><span className="due-cell">{issue.dueDate}<small>{issue.ageDays === 0 ? "raised today" : `open ${issue.ageDays} days`}</small></span><span className={`issue-state state-${issue.status}`}>{issue.status}</span></article>)}
        </div>
      </div>
    </section>
  );
}

function CallsTab({ project, onCall, onDispatch, dispatching }: { project: ProjectDetailType; onCall: (call: SiteCall) => void; onDispatch: () => void; dispatching: boolean }) {
  return (
    <div className="calls-tab-grid">
      <section className="double-shell calls-ledger-shell"><div className="panel-core"><div className="panel-heading"><div><span className="eyebrow">17 August call run</span><h2>Conversation ledger</h2></div><button className="primary-button compact-button" onClick={onDispatch} disabled={dispatching}><span>{dispatching ? "Starting…" : "Call everyone"}</span><span className="button-orb"><Icon name="phone" size={14}/></span></button></div><div className="call-ledger">{project.team.map((person) => { const call = project.calls.find((item) => item.contactName === person.name); return <article key={person.id}><span className="voice-avatar large-avatar">{person.initials}</span><div><strong>{person.name}</strong><small>{person.role} · {person.phoneMasked}</small></div><span className="streak"><Icon name="trend" size={13}/>{person.responseStreak} day streak</span><StatusPill status={person.lastCallStatus}/><span className="call-time">{call ? `${call.startedAt} · ${formatDuration(call.durationSeconds)}` : person.callTime}</span>{call ? <button className="round-action" onClick={() => onCall(call)} aria-label={`Open ${person.name}'s call`}><Icon name="play" size={14}/></button> : <button className="round-action" onClick={onDispatch} aria-label={`Call ${person.name}`}><Icon name="phone" size={14}/></button>}</article>})}</div></div></section>
      <aside className="double-shell prompt-shell"><div className="panel-core"><span className="eyebrow">Agent briefing</span><h2>Tonight’s prompts</h2><ol><li><span>01</span><p>What work did your team complete today?</p></li><li><span>02</span><p>What challenged progress or quality?</p></li><li><span>03</span><p>What is planned for tomorrow?</p></li><li><span>04</span><p>What could block that plan?</p></li><li><span>05</span><p>Any safety incidents or observations?</p></li></ol><div className="context-injection"><Icon name="spark" size={16}/><p><strong>3 follow-ups injected</strong> from yesterday’s unresolved topics.</p></div></div></aside>
    </div>
  );
}

function CallDrawer({ call, onClose }: { call: SiteCall; onClose: () => void }) {
  const [playing, setPlaying] = useState(false);
  return (
    <><button className="drawer-scrim" aria-label="Close conversation" onClick={onClose}/><aside className="call-drawer" role="dialog" aria-modal="true" aria-labelledby="call-title"><header><div><span className="eyebrow">Voice evidence · Today {call.startedAt}</span><h2 id="call-title">{call.contactName}</h2><p>{call.role} · {formatDuration(call.durationSeconds)}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="close"/></button></header><div className="audio-player"><button onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause audio" : "Play audio"}><Icon name={playing ? "pause" : "play"} size={17}/></button><div className={`waveform ${playing ? "wave-playing" : ""}`}>{Array.from({ length: 34 }, (_, index) => <i key={index} style={{ transform: `scaleY(${0.2 + ((index * 7) % 10) / 12})` }}/>)}</div><span>{playing ? "01:12" : "00:00"} / {formatDuration(call.durationSeconds)}</span></div><section className="call-summary"><span className="eyebrow">AI summary</span><p>{call.summary}</p></section><section className="answer-grid"><Answer label="Completed" value={call.answers.completed}/><Answer label="Challenges" value={call.answers.challenges}/><Answer label="Tomorrow" value={call.answers.tomorrow}/><Answer label="Blockers" value={call.answers.blockers}/><Answer label="Safety" value={call.answers.safety}/></section><section className="transcript-section"><div><span className="eyebrow">Transcript</span><small>{call.transcript.length ? `${call.transcript.length} turns shown` : "Full transcript stored"}</small></div>{call.transcript.length ? call.transcript.map((turn, index) => <div className={`transcript-turn turn-${turn.role}`} key={`${turn.at}-${index}`}><span>{turn.role === "agent" ? "FB" : initials(call.contactName)}</span><p>{turn.message}</p><small>{turn.at}</small></div>) : <div className="transcript-empty">Transcript is stored and available in the production call record.</div>}</section></aside></>
  );
}

function Answer({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><p>{value}</p></div>;
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

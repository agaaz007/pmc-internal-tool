"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProgramOverview, ProjectStatus } from "@/lib/types";
import { Icon } from "./icons";
import { ProgressRing } from "./progress-ring";
import { StatusPill } from "./status-pill";

type FilterStatus = "all" | ProjectStatus;

export function OverviewDashboard({ data }: { data: ProgramOverview }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [region, setRegion] = useState("all");
  const [toast, setToast] = useState<string | null>(null);

  const regions = useMemo(() => Array.from(new Set(data.projects.map((project) => project.region))), [data.projects]);
  const filteredProjects = useMemo(() => data.projects.filter((project) => {
    const matchesQuery = `${project.name} ${project.code} ${project.location}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "all" || project.status === status) && (region === "all" || project.region === region);
  }), [data.projects, query, region, status]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  return (
    <div className="page-wrap page-enter">
      <section className="page-heading">
        <div>
          <span className="eyebrow">Portfolio command centre</span>
          <h1>Good evening, Rakesh.</h1>
          <p>Here’s what happened across your sites today, distilled from {data.callsCompleted} field conversations.</p>
        </div>
        <button className="primary-button group" onClick={() => showToast("All available site reports are being compiled.")}>
          <span>Generate all DPRs</span><span className="button-orb"><Icon name="spark" size={16}/></span>
        </button>
      </section>

      <section className="metric-strip" aria-label="Portfolio summary">
        <Metric label="Active projects" value={String(data.activeSites).padStart(2, "0")} detail="Across 3 regions" icon="building" />
        <Metric label="Portfolio progress" value={`${data.portfolioProgress}%`} detail="1.4% ahead of plan" icon="trend" good />
        <Metric label="Calls completed" value={`${data.callsCompleted}/${data.callsExpected}`} detail="84% response rate" icon="phone" />
        <Metric label="Open issues" value={String(data.openIssues).padStart(2, "0")} detail={`${data.criticalIssues} critical`} icon="alert" warn={data.criticalIssues > 0} />
        <Metric label="DPRs delivered" value={`${data.reportsSent}/${data.reportsExpected}`} detail="2 reports processing" icon="report" />
      </section>

      <section className="attention-card double-shell" id="issues">
        <div className="attention-core">
          <span className="attention-icon"><Icon name="alert" /></span>
          <div className="attention-copy">
            <span className="eyebrow eyebrow-rust">Needs intervention</span>
            <h2>Two issues could move a milestone this week.</h2>
            <p>North Gate’s AHU delivery is 9 days late. Riverstone’s clubhouse fire NOC remains unsigned after the revised drawing submission.</p>
          </div>
          <Link href="/projects/north-gate" className="text-link">Review issues <span><Icon name="arrow" size={15}/></span></Link>
        </div>
      </section>

      <section className="section-block" id="projects">
        <div className="section-heading">
          <div><span className="eyebrow">Live portfolio</span><h2>Project pulse</h2></div>
          <p>Last synchronized {data.generatedAt}</p>
        </div>

        <div className="filter-bar double-shell">
          <div className="filter-core">
            <label className="project-search"><Icon name="search" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sites, cities or codes" aria-label="Search projects" /></label>
            <div className="segmented-control" aria-label="Filter by health">
              {(["all", "on-track", "watch", "at-risk"] as FilterStatus[]).map((value) => (
                <button key={value} className={status === value ? "selected" : ""} onClick={() => setStatus(value)}>
                  {value === "all" ? "All sites" : value === "on-track" ? "On track" : value === "watch" ? "Attention" : "At risk"}
                </button>
              ))}
            </div>
            <label className="select-control"><Icon name="filter" size={16}/><select value={region} onChange={(event) => setRegion(event.target.value)} aria-label="Filter by region"><option value="all">All regions</option>{regions.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>
        </div>

        <div className="project-grid">
          {filteredProjects.map((project) => (
            <Link href={`/projects/${project.id}`} key={project.id} className="project-shell double-shell">
              <article className="project-card">
                <div className="project-card-top">
                  <div className="project-code"><span style={{ background: project.accent }}>{project.code.slice(0, 2)}</span><div><small>{project.code}</small><h3>{project.name}</h3><p>{project.location}</p></div></div>
                  <StatusPill status={project.status} />
                </div>
                <div className="project-progress-row">
                  <ProgressRing value={project.progress} color={project.accent} />
                  <div className="project-progress-copy"><span>Overall progress</span><strong>{project.progress >= project.plannedProgress ? `${project.progress - project.plannedProgress}% ahead` : `${project.plannedProgress - project.progress}% behind`} plan</strong><small>{project.phase} phase</small></div>
                  <div className="mini-bars" aria-label={`Actual ${project.progress}%, planned ${project.plannedProgress}%`}><span style={{ height: `${Math.max(28, project.plannedProgress)}%` }}/><i style={{ height: `${Math.max(28, project.progress)}%`, background: project.accent }}/></div>
                </div>
                <div className="project-stats">
                  <div><small>Daily calls</small><strong>{project.callsCompleted}<span>/{project.callsExpected}</span></strong></div>
                  <div><small>Open issues</small><strong className={project.criticalIssues ? "danger-text" : ""}>{project.openIssues}<span>{project.criticalIssues ? ` · ${project.criticalIssues} critical` : " · clear"}</span></strong></div>
                  <div><small>Next milestone</small><strong>{project.nextMilestoneDate}</strong></div>
                </div>
                <div className="project-card-foot"><span><i className={`report-dot report-${project.reportStatus}`}/>{project.reportStatus === "sent" ? "DPR sent" : project.reportStatus === "drafting" ? "DPR processing" : "Waiting for calls"}</span><b>Open project <Icon name="arrow" size={14}/></b></div>
              </article>
            </Link>
          ))}
          {filteredProjects.length === 0 && <div className="empty-state"><Icon name="building" size={28}/><h3>No matching projects</h3><p>Try clearing a filter or searching another site.</p><button onClick={() => { setQuery(""); setStatus("all"); setRegion("all"); }}>Clear filters</button></div>}
        </div>
      </section>

      <section className="lower-grid" id="calls">
        <div className="double-shell panel-shell">
          <div className="panel-core">
            <div className="panel-heading"><div><span className="eyebrow">Voice operations</span><h2>Today’s call run</h2></div><span className="completion-fraction"><b>{data.callsCompleted}</b> of {data.callsExpected}</span></div>
            <div className="call-run-list">
              {data.projects.map((project) => (
                <div className="call-run-row" key={project.id}>
                  <span className="site-monogram" style={{ background: project.accent }}>{project.code.slice(0, 2)}</span>
                  <div><strong>{project.name}</strong><small>{project.callsCompleted === project.callsExpected ? "All conversations complete" : `${project.callsExpected - project.callsCompleted} calls remaining`}</small></div>
                  <span className="call-fraction">{project.callsCompleted}/{project.callsExpected}</span>
                  <div className="tiny-progress"><i style={{ transform: `scaleX(${project.callsCompleted / project.callsExpected})`, background: project.accent }}/></div>
                </div>
              ))}
            </div>
            <button className="secondary-button full-button" onClick={() => showToast("Missed calls queued for retry in 15 minutes.")}><Icon name="phone" size={16}/> Retry missed calls</button>
          </div>
        </div>

        <div className="double-shell panel-shell" id="reports">
          <div className="panel-core intelligence-panel">
            <div className="panel-heading"><div><span className="eyebrow">Portfolio intelligence</span><h2>What changed today</h2></div><span className="ai-mark"><Icon name="spark" size={16}/></span></div>
            <div className="insight-stack">
              <article><span className="insight-index">01</span><div><strong>Facade supply risk is spreading</strong><p>Two sites now report fixing-material shortages. Combined exposure is 4–6 working days.</p><Link href="/projects/meridian-heights">Inspect evidence <Icon name="arrow" size={13}/></Link></div></article>
              <article><span className="insight-index">02</span><div><strong>Structure productivity improved</strong><p>Meridian’s slab cycle held at 8 days for a third floor, preserving its two-day lead.</p><Link href="/projects/meridian-heights">View progress <Icon name="arrow" size={13}/></Link></div></article>
              <article><span className="insight-index">03</span><div><strong>Response quality is trending up</strong><p>Daily call completion rose from 71% to 84% over the past seven working days.</p><button onClick={() => showToast("Voice performance report opened in preview mode.")}>View call analytics <Icon name="arrow" size={13}/></button></div></article>
            </div>
          </div>
        </div>
      </section>

      {toast && <div className="toast" role="status"><Icon name="check" size={16}/><span>{toast}</span></div>}
    </div>
  );
}

function Metric({ label, value, detail, icon, good, warn }: { label: string; value: string; detail: string; icon: "building" | "trend" | "phone" | "alert" | "report"; good?: boolean; warn?: boolean }) {
  return (
    <article className="metric-item">
      <span className={`metric-icon ${warn ? "metric-warn" : ""}`}><Icon name={icon} size={18}/></span>
      <div><small>{label}</small><strong>{value}</strong><p className={good ? "good-text" : warn ? "danger-text" : ""}>{good && <Icon name="trend" size={12}/>} {detail}</p></div>
    </article>
  );
}

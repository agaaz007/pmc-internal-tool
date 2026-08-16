"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon, type IconName } from "./icons";

const navigation: Array<{ label: string; href: string; icon: IconName }> = [
  { label: "Overview", href: "/", icon: "overview" },
  { label: "Projects", href: "/#projects", icon: "building" },
  { label: "Voice calls", href: "/#calls", icon: "phone" },
  { label: "DPR reports", href: "/#reports", icon: "report" },
  { label: "Issues", href: "/#issues", icon: "alert" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-frame">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <Link href="/" className="brand" aria-label="FieldBrief home" onClick={() => setMenuOpen(false)}>
            <span className="brand-mark"><span /></span>
            <span className="brand-word">FieldBrief</span>
          </Link>
          <button className="icon-button mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><Icon name="close" /></button>
        </div>

        <div className="workspace-switcher">
          <span className="workspace-avatar">MB</span>
          <span><small>Workspace</small><strong>Mavrik Buildcon</strong></span>
          <Icon name="chevron" size={15} />
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          <span className="nav-kicker">Workspace</span>
          {navigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : false;
            return (
              <Link key={item.label} href={item.href} className={`nav-item ${active ? "active" : ""}`} onClick={() => setMenuOpen(false)}>
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                {item.label === "Issues" && <em>3</em>}
              </Link>
            );
          })}
          <span className="nav-kicker nav-kicker-spaced">System</span>
          <Link href="/#settings" className="nav-item" onClick={() => setMenuOpen(false)}><Icon name="settings" size={18} /><span>Settings</span></Link>
        </nav>

        <div className="voice-status">
          <div className="voice-status-head"><span className="live-dot"/><strong>Voice agent live</strong></div>
          <p>Next call window</p>
          <div><span>Tomorrow</span><b>18:00</b></div>
        </div>

        <div className="profile-row">
          <span className="profile-avatar">RK</span>
          <span><strong>Rakesh Kumar</strong><small>Head office</small></span>
          <Icon name="more" size={18} />
        </div>
      </aside>

      {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}

      <div className="content-column">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
          <div className="topbar-date"><span>Monday</span><strong>17 August 2026</strong></div>
          <div className="topbar-actions">
            <button className="search-button" aria-label="Search projects"><Icon name="search" size={17}/><span>Search anything</span><kbd>⌘ K</kbd></button>
            <span className="sync-state"><i/><span>Live</span></span>
            <button className="icon-button notification-button" aria-label="Notifications"><Icon name="alert" size={18}/><span/></button>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

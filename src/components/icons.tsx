import type { SVGProps } from "react";

export type IconName =
  | "overview"
  | "building"
  | "phone"
  | "report"
  | "alert"
  | "settings"
  | "search"
  | "filter"
  | "arrow"
  | "trend"
  | "check"
  | "clock"
  | "calendar"
  | "users"
  | "weather"
  | "more"
  | "download"
  | "upload"
  | "send"
  | "close"
  | "menu"
  | "spark"
  | "chevron"
  | "play"
  | "pause";

const paths: Record<IconName, React.ReactNode> = {
  overview: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h4A1.5 1.5 0 0 1 11 5.5v4A1.5 1.5 0 0 1 9.5 11h-4A1.5 1.5 0 0 1 4 9.5z"/><path d="M14 5.5A1.5 1.5 0 0 1 15.5 4h3A1.5 1.5 0 0 1 20 5.5v8a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M4 15.5A1.5 1.5 0 0 1 5.5 14h4a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 9.5 20h-4A1.5 1.5 0 0 1 4 18.5z"/><path d="M14 18h6"/></>,
  building: <><path d="M5 21V5.7a1 1 0 0 1 .66-.94l8-2.83A1 1 0 0 1 15 2.87V21"/><path d="M15 9h3.4a.6.6 0 0 1 .6.6V21M2 21h20M8 7h1M8 11h1M8 15h1M12 7h1M12 11h1M12 15h1M8 21v-2.5h4V21"/></>,
  phone: <><path d="M7.2 3.5 9.4 8a1.2 1.2 0 0 1-.35 1.44l-1.3 1.02a14.1 14.1 0 0 0 5.8 5.8l1.02-1.3A1.2 1.2 0 0 1 16 14.6l4.5 2.2a1.2 1.2 0 0 1 .64 1.3l-.37 2.05a2 2 0 0 1-1.96 1.64C9.64 21.8 2.2 14.36 2.2 5.2a2 2 0 0 1 1.64-1.96l2.05-.37a1.2 1.2 0 0 1 1.31.64Z"/></>,
  report: <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></>,
  alert: <><path d="M12 3.2 22 20H2z"/><path d="M12 9v5M12 17.5v.1"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 8.95 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.09 14H3v-4h.09A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34H9A1.7 1.7 0 0 0 10 3.09V3h4v.09a1.7 1.7 0 0 0 1.05 1.51 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.82 7l-.06.06a1.7 1.7 0 0 0-.34 1.88V9A1.7 1.7 0 0 0 20.91 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z"/></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
  filter: <><path d="M4 6h16M7 12h10M10 18h4"/></>,
  arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
  trend: <><path d="m4 16 5-5 4 4 7-8"/><path d="M15 7h5v5"/></>,
  check: <path d="m5 12 4.2 4.2L19 6.5"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></>,
  users: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M17 11a3 3 0 1 0 0-6M21 20v-1.5a4 4 0 0 0-3-3.75"/></>,
  weather: <><path d="M7 18h10.2a3.8 3.8 0 0 0 .34-7.59A6 6 0 0 0 6.2 9.5 4.25 4.25 0 0 0 7 18Z"/><path d="M8 21h.01M12 21h.01M16 21h.01"/></>,
  more: <><circle cx="5" cy="12" r=".8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r=".8" fill="currentColor" stroke="none"/></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></>,
  upload: <><path d="M12 21V9M7 14l5-5 5 5M4 3h16"/></>,
  send: <><path d="m3 11 18-8-8 18-2-8zM11 13 21 3"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  menu: <><path d="M4 8h16M4 16h16"/></>,
  spark: <><path d="m12 2 1.2 5.2L18 9l-4.8 1.8L12 16l-1.2-5.2L6 9l4.8-1.8zM19 15l.6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6z"/></>,
  chevron: <path d="m9 6 6 6-6 6"/>,
  play: <path d="m9 6 9 6-9 6z"/>,
  pause: <><path d="M9 7v10M15 7v10"/></>,
};

export function Icon({ name, size = 20, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}

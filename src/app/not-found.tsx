import Link from "next/link";
import { Icon } from "@/components/icons";

export default function NotFound() {
  return <div className="not-found"><span className="large-monogram">404</span><span className="eyebrow">Project not found</span><h1>This site isn’t in the portfolio.</h1><p>It may have been archived, or the link is incorrect.</p><Link href="/" className="primary-button"><span>Return to overview</span><span className="button-orb"><Icon name="arrow" size={15}/></span></Link></div>;
}

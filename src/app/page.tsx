import { OverviewDashboard } from "@/components/overview-dashboard";
import { getProgramOverview } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getProgramOverview();
  return <OverviewDashboard data={data} />;
}

import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/project-detail";
import { getProjectDetail } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);
  if (!project) notFound();
  return <ProjectDetail project={project}/>;
}

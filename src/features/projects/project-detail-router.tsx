import { useParams } from "react-router-dom";
import { useProject } from "@/features/projects/use-projects";
import { ProjectDetailPage } from "@/features/projects/project-detail-page";
import { VoyageDetailPage } from "@/features/voyages/voyage-detail-page";

export function ProjectDetailRouter() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading } = useProject(projectId);

  if (isLoading || !project) return <p className="text-muted-foreground">Chargement...</p>;

  const isVoyage = project.categories?.module_key === "voyages";

  if (isVoyage && projectId) {
    return <VoyageDetailPage projectId={projectId} />;
  }

  return <ProjectDetailPage />;
}

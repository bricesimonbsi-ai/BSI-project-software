import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useProject, useUpdateProject, useDeleteProject } from "@/features/projects/use-projects";
import { ProjectTitleInput } from "@/features/projects/project-title-input";
import { useThemeStore } from "@/features/theme/theme-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CollaboratorsPanel } from "@/features/projects/collaborators-panel";
import { EmojiPickerButton } from "@/features/shared/emoji-picker";
import { Breadcrumb } from "@/features/navigation/breadcrumb";
import { ProjectSwitcher } from "@/features/navigation/project-switcher";
import { PageHeroCard } from "@/features/shared/page-hero-card";
import { IconGlow } from "@/features/shared/icon-glow";
import { RestaurantSection } from "@/features/restaurants/restaurant-section";
import { RESTAURANT_TYPE_LABELS } from "@/features/restaurants/restaurant-constants";
import { MediaPeoplePanel } from "@/features/media/media-people-panel";
import { toast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

export function RestaurantListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [deleting, setDeleting] = useState(false);
  const setAccentColor = useThemeStore((s) => s.setAccentColor);

  useEffect(() => {
    if (project?.categories?.color) setAccentColor(project.categories.color);
    return () => setAccentColor(null);
  }, [project, setAccentColor]);

  if (isLoading || !project || !projectId) return <p className="text-muted-foreground">Chargement...</p>;

  async function handleDelete() {
    if (!window.confirm(`Supprimer définitivement "${project?.title ?? ""}" ? Cette action est irréversible.`)) return;
    setDeleting(true);
    try {
      await deleteProject.mutateAsync(project!.id);
      navigate("/");
    } catch (err) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeroCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb
            items={[
              { label: "Accueil", to: "/" },
              { label: project.categories?.name ?? "Catégorie", to: `/categories/${project.category_id}`, icon: project.categories?.icon },
              { label: project.title, icon: project.icon },
            ]}
          />
          <ProjectSwitcher currentProjectId={project.id} currentCategoryId={project.category_id} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconGlow>
              <EmojiPickerButton value={project.icon} onChange={(icon) => updateProject.mutate({ id: project.id, icon })} />
            </IconGlow>
            <ProjectTitleInput projectId={project.id} title={project.title} />
          </div>
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="mr-2 h-4 w-4" /> {deleting ? "Suppression..." : "Supprimer"}
          </Button>
        </div>
      </PageHeroCard>

      <Tabs defaultValue="contenu">
        <TabsList>
          <TabsTrigger value="contenu">
            {project.restaurant_type ? RESTAURANT_TYPE_LABELS[project.restaurant_type].plural : "Bars & Restaurants"}
          </TabsTrigger>
          <TabsTrigger value="people">Personnes</TabsTrigger>
          <TabsTrigger value="collaborators">Collaborateurs</TabsTrigger>
        </TabsList>

        <TabsContent value="contenu">
          <RestaurantSection projectId={projectId} restaurantType={project.restaurant_type} />
        </TabsContent>

        <TabsContent value="people">
          <MediaPeoplePanel projectId={projectId} />
        </TabsContent>

        <TabsContent value="collaborators">
          <CollaboratorsPanel projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

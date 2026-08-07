import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useCategories } from "@/features/portfolio/use-categories";
import { useProjects } from "@/features/projects/use-projects";
import { useThemeStore } from "@/features/theme/theme-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { Breadcrumb } from "@/features/navigation/breadcrumb";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusLabel: Record<string, string> = {
  active: "Actif",
  upcoming: "À venir",
  completed: "Terminé",
  archived: "Archivé",
};

export function CategoryDetailPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const { data: categories } = useCategories();
  const { data: projects, isLoading } = useProjects();
  const setAccentColor = useThemeStore((s) => s.setAccentColor);

  const category = categories?.find((c) => c.id === categoryId);
  const categoryProjects = (projects ?? []).filter((p) => p.category_id === categoryId);

  useEffect(() => {
    if (category) setAccentColor(category.color);
    return () => setAccentColor(null);
  }, [category, setAccentColor]);

  if (!category) return <p className="text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: "Accueil", to: "/" }, { label: category.name, icon: category.icon }]} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 rounded-full" style={{ backgroundColor: category.color }} />
          <h1 className="text-2xl font-bold">
            {category.icon && <span className="mr-2">{category.icon}</span>}
            {category.name}
          </h1>
        </div>
        <NewProjectDialog category={category} />
      </div>

      {isLoading && <p className="text-muted-foreground">Chargement des projets...</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categoryProjects.map((project) => (
          <Link key={project.id} to={`/projects/${project.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    {project.icon && <span>{project.icon}</span>}
                    {project.title}
                  </CardTitle>
                  <Badge variant="secondary">{statusLabel[project.status]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {project.description && <p className="line-clamp-2">{project.description}</p>}
                {project.start_date && <p>Début : {formatDate(project.start_date)}</p>}
                {(project.budget_planned || project.budget_actual) && (
                  <p>
                    Budget : {formatCurrency(project.budget_actual ?? project.budget_planned ?? 0, project.currency)}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
        {!isLoading && categoryProjects.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun projet dans cette catégorie pour l'instant.</p>
        )}
      </div>
    </div>
  );
}

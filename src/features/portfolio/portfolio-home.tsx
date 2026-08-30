import { useMemo } from "react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays, isFuture, isPast, parseISO } from "date-fns";
import { useAuth } from "@/app/providers/auth-provider";
import { useCategories } from "@/features/portfolio/use-categories";
import { useProjects, type ProjectWithCategory } from "@/features/projects/use-projects";
import { useThemeStore } from "@/features/theme/theme-store";
import { FeaturedProjectPanel } from "@/features/portfolio/featured-project-panel";
import { CategoryOrbitalLayout, orbitalNodeColor } from "@/features/portfolio/category-orbital-layout";
import { AgendaPreview } from "@/features/portfolio/agenda-preview";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { ChevronRight, Shapes } from "lucide-react";
import type { Category } from "@/types/database";

export interface CategoryStat {
  category: Category;
  projects: ProjectWithCategory[];
  activeCount: number;
  upcomingCount: number;
}

export function PortfolioHome() {
  const { profile } = useAuth();
  const { data: categories, isLoading: loadingCategories } = useCategories();
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const categoryLayout = useThemeStore((s) => s.categoryLayout);
  const orbitalAccent = useThemeStore((s) => s.orbitalAccent);

  // Les catégories sont visibles par tout compte authentifié (liste globale gérée par
  // l'administrateur), mais un collaborateur invité sur un seul projet ne doit voir sur son
  // accueil que les catégories où il a effectivement accès à au moins un projet — pas la liste
  // complète, qui révélerait l'existence de catégories/projets auxquels il n'a pas accès.
  // `projects` est déjà filtré côté RLS aux projets accessibles par le compte courant, donc pour
  // l'admin (propriétaire du portefeuille) on garde toutes les catégories actives, y compris
  // celles sans projet pour l'instant.
  const activeCategories = useMemo(() => {
    const active = (categories ?? []).filter((c) => c.status === "active");
    if (profile?.is_admin) return active;
    const accessibleCategoryIds = new Set((projects ?? []).map((p) => p.category_id));
    return active.filter((c) => accessibleCategoryIds.has(c.id));
  }, [categories, projects, profile?.is_admin]);

  // Met en avant un projet EN COURS en priorité (sinon il disparaîtrait du bandeau dès sa date
  // de début passée, alors que c'est justement le moment où il est le plus utile de le retrouver
  // rapidement), sinon le plus proche projet à venir.
  const featuredProject = useMemo(() => {
    const withDates = (projects ?? []).filter((p) => p.start_date && p.end_date);
    const ongoing = withDates.find((p) => !isFuture(parseISO(p.start_date!)) && !isPast(parseISO(p.end_date!)));
    if (ongoing) return { project: ongoing, status: "ongoing" as const };
    // Repli sur le statut saisi manuellement (project.status) quand aucune date n'est renseignée —
    // beaucoup de projets non-Voyage (Cadeaux, Courses, Santé & bien-être...) n'ont pas de
    // start_date/end_date du tout, et ne remonteraient sinon jamais ici malgré un statut "actif".
    const activeNoDate = (projects ?? []).find((p) => p.status === "active");
    if (activeNoDate) return { project: activeNoDate, status: "ongoing" as const };
    const upcoming = (projects ?? [])
      .filter((p) => p.start_date && isFuture(parseISO(p.start_date)))
      .sort((a, b) => parseISO(a.start_date!).getTime() - parseISO(b.start_date!).getTime())[0];
    if (upcoming) return { project: upcoming, status: "upcoming" as const };
    const upcomingNoDate = (projects ?? []).find((p) => p.status === "upcoming");
    if (upcomingNoDate) return { project: upcomingNoDate, status: "upcoming" as const };
    return null;
  }, [projects]);

  // Les prochains départs/débuts, hors celui déjà mis en avant ci-dessus — occupe l'espace
  // libéré par les anciens indicateurs génériques avec quelque chose de plus actionnable. Repli sur
  // le statut manuel si aucun projet restant n'a de date de début renseignée (même raison que
  // featuredProject ci-dessus).
  const upcomingProjects = useMemo(() => {
    const dated = (projects ?? [])
      .filter((p) => p.id !== featuredProject?.project.id && p.start_date && isFuture(parseISO(p.start_date)))
      .sort((a, b) => parseISO(a.start_date!).getTime() - parseISO(b.start_date!).getTime());
    if (dated.length > 0) return dated.slice(0, 6);
    return (projects ?? []).filter((p) => p.id !== featuredProject?.project.id && p.status === "upcoming").slice(0, 6);
  }, [projects, featuredProject]);

  const categoryStats: CategoryStat[] = useMemo(() => {
    const map = new Map<string, ProjectWithCategory[]>();
    for (const p of projects ?? []) {
      const list = map.get(p.category_id) ?? [];
      list.push(p);
      map.set(p.category_id, list);
    }
    return activeCategories.map((category) => {
      const catProjects = map.get(category.id) ?? [];
      return {
        category,
        projects: catProjects,
        activeCount: catProjects.filter((p) => p.status === "active").length,
        upcomingCount: catProjects.filter((p) => p.status === "upcoming").length,
      };
    });
  }, [activeCategories, projects]);

  // Pour teinter les tickets "Prochainement" en cohérence avec les nœuds de la disposition
  // Orbital (même index de catégorie → même couleur), sans effet sur les 3 autres dispositions.
  const orbitalCategoryIndex = useMemo(
    () => new Map(activeCategories.map((c, i) => [c.id, i])),
    [activeCategories]
  );

  if (loadingCategories || loadingProjects) {
    return <p className="text-muted-foreground">Chargement du portefeuille...</p>;
  }

  const featuredSection = featuredProject && (
    <FeaturedProjectPanel project={featuredProject.project} status={featuredProject.status} />
  );

  const upcomingSection = upcomingProjects.length > 0 && (
    <div>
      <h2 className="mb-3 text-lg font-semibold">Prochainement</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {upcomingProjects.map((p) => {
          const idx = orbitalCategoryIndex.get(p.category_id);
          const orbitalColor =
            categoryLayout === "orbital" && idx !== undefined
              ? orbitalNodeColor(idx, activeCategories.length, orbitalAccent)
              : null;
          return (
            <Link key={p.id} to={`/projects/${p.id}`} className="flex-shrink-0">
              <Card
                className="w-56 transition-shadow hover:shadow-lg hover:shadow-accent/20 dark:hover:shadow-accent/25"
                style={orbitalColor ? { borderLeft: `3px solid ${orbitalColor}` } : undefined}
              >
                <CardContent className="space-y-1 p-4">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {p.icon && <span>{p.icon}</span>}
                    {p.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{p.categories?.name}</p>
                  {p.start_date && (
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.start_date)} · dans {differenceInCalendarDays(parseISO(p.start_date), new Date())} j
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {categoryLayout === "orbital" ? (
        // Contrairement aux 3 autres dispositions (naturellement remplies de haut en bas), l'anneau
        // Orbital laisse un grand vide en dessous quand peu de contenu suit — on centre verticalement
        // tout le bloc dans l'espace disponible plutôt que de le laisser collé en haut de l'écran.
        <div className="flex min-h-[65vh] flex-col justify-center gap-6">
          <CategoryOrbitalLayout stats={categoryStats} accentStyle={orbitalAccent} greetingName={profile?.display_name} />
          {featuredSection}
          {upcomingSection}
          <AgendaPreview />
        </div>
      ) : (
        <>
          {featuredSection}
          {upcomingSection}
          <AgendaPreview />
          <div>
            <h2 className="mb-3 text-lg font-semibold">Catégories de projets</h2>
            {categoryLayout === "list" && <CategoryListLayout stats={categoryStats} />}
            {categoryLayout === "grid" && <CategoryGridLayout stats={categoryStats} />}
            {categoryLayout === "circle" && <CategoryCircleLayout stats={categoryStats} />}
          </div>
        </>
      )}
    </div>
  );
}

function CategoryIcon({ stat, className }: { stat: CategoryStat; className?: string }) {
  return (
    <span
      className={cn("flex flex-shrink-0 items-center justify-center rounded-xl", className)}
      style={{ backgroundColor: `${stat.category.color}26` }}
    >
      {stat.category.icon ?? <Shapes className="h-5 w-5" style={{ color: stat.category.color }} />}
    </span>
  );
}

function CategoryListLayout({ stats }: { stats: CategoryStat[] }) {
  return (
    <div className="space-y-2">
      {stats.map((stat) => (
        <Link key={stat.category.id} to={`/categories/${stat.category.id}`}>
          <Card className="transition-shadow hover:shadow-lg hover:shadow-accent/20 dark:hover:shadow-accent/25">
            <CardContent className="flex items-center gap-4 p-4">
              <CategoryIcon stat={stat} className="h-12 w-12 text-2xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{stat.category.name}</p>
                <p className="text-sm text-muted-foreground">
                  {stat.projects.length} projet{stat.projects.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                {stat.activeCount > 0 && (
                  <Badge variant="secondary">
                    {stat.activeCount} actif{stat.activeCount > 1 ? "s" : ""}
                  </Badge>
                )}
                {stat.upcomingCount > 0 && <Badge variant="outline">{stat.upcomingCount} à venir</Badge>}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function CategoryGridLayout({ stats }: { stats: CategoryStat[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stats.map((stat) => (
        <Link key={stat.category.id} to={`/categories/${stat.category.id}`}>
          <Card className="h-full transition-shadow hover:shadow-lg hover:shadow-accent/20 dark:hover:shadow-accent/25">
            <CardContent className="flex flex-col items-center gap-2 p-5 text-center">
              <CategoryIcon stat={stat} className="h-16 w-16 rounded-2xl text-3xl" />
              <p className="font-semibold">{stat.category.name}</p>
              <p className="text-sm text-muted-foreground">
                {stat.projects.length} projet{stat.projects.length !== 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap justify-center gap-1">
                {stat.activeCount > 0 && (
                  <Badge variant="secondary">
                    {stat.activeCount} actif{stat.activeCount > 1 ? "s" : ""}
                  </Badge>
                )}
                {stat.upcomingCount > 0 && <Badge variant="outline">{stat.upcomingCount} à venir</Badge>}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function CategoryCircleLayout({ stats }: { stats: CategoryStat[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-6 sm:justify-start">
      {stats.map((stat) => (
        <Link key={stat.category.id} to={`/categories/${stat.category.id}`} className="group flex w-24 flex-col items-center gap-2 text-center">
          <span
            className="flex h-20 w-20 items-center justify-center rounded-full text-3xl shadow-sm transition group-hover:scale-105"
            style={{ backgroundColor: `${stat.category.color}26`, border: `2px solid ${stat.category.color}` }}
          >
            {stat.category.icon ?? <Shapes className="h-6 w-6" style={{ color: stat.category.color }} />}
          </span>
          <p className="text-sm font-medium leading-tight">{stat.category.name}</p>
          <p className="text-xs leading-tight text-muted-foreground">
            {stat.projects.length} projet{stat.projects.length !== 1 ? "s" : ""}
          </p>
          {(stat.activeCount > 0 || stat.upcomingCount > 0) && (
            <div className="flex flex-wrap justify-center gap-1">
              {stat.activeCount > 0 && <Badge variant="secondary">{stat.activeCount}</Badge>}
              {stat.upcomingCount > 0 && <Badge variant="outline">{stat.upcomingCount}</Badge>}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

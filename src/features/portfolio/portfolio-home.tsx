import { useMemo } from "react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays, differenceInDays, isFuture, isPast, parseISO } from "date-fns";
import { useCategories } from "@/features/portfolio/use-categories";
import { useProjects, type ProjectWithCategory } from "@/features/projects/use-projects";
import { useTodos } from "@/features/todos/use-todos";
import { useGlobalPendingExpensesCount } from "@/features/voyages/use-expenses";
import { useThemeStore } from "@/features/theme/theme-store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { CalendarClock, ListChecks, ArrowRight, ChevronRight, Shapes, FolderKanban, ReceiptText } from "lucide-react";
import type { Category } from "@/types/database";

interface CategoryStat {
  category: Category;
  projects: ProjectWithCategory[];
  activeCount: number;
  upcomingCount: number;
}

export function PortfolioHome() {
  const { data: categories, isLoading: loadingCategories } = useCategories();
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const { data: todos } = useTodos();
  const { data: pendingExpensesCount } = useGlobalPendingExpensesCount();
  const categoryLayout = useThemeStore((s) => s.categoryLayout);

  const activeCategories = useMemo(() => (categories ?? []).filter((c) => c.status === "active"), [categories]);

  // Met en avant un projet EN COURS en priorité (sinon il disparaîtrait du bandeau dès sa date
  // de début passée, alors que c'est justement le moment où il est le plus utile de le retrouver
  // rapidement), sinon le plus proche projet à venir.
  const featuredProject = useMemo(() => {
    const withDates = (projects ?? []).filter((p) => p.start_date && p.end_date);
    const ongoing = withDates.find((p) => !isFuture(parseISO(p.start_date!)) && !isPast(parseISO(p.end_date!)));
    if (ongoing) return { project: ongoing, status: "ongoing" as const };
    const upcoming = (projects ?? [])
      .filter((p) => p.start_date && isFuture(parseISO(p.start_date)))
      .sort((a, b) => parseISO(a.start_date!).getTime() - parseISO(b.start_date!).getTime())[0];
    if (upcoming) return { project: upcoming, status: "upcoming" as const };
    return null;
  }, [projects]);

  const metrics = useMemo(() => {
    const daysPlanned = (projects ?? [])
      .filter((p) => p.status === "active" || p.status === "upcoming")
      .reduce((sum, p) => {
        if (!p.start_date || !p.end_date) return sum;
        return sum + Math.max(0, differenceInDays(parseISO(p.end_date), parseISO(p.start_date)));
      }, 0);
    const openTasks = (todos ?? []).filter((t) => !t.done).length;
    const activeProjects = (projects ?? []).filter((p) => p.status === "active").length;
    return { daysPlanned, openTasks, activeProjects };
  }, [projects, todos]);

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

  if (loadingCategories || loadingProjects) {
    return <p className="text-muted-foreground">Chargement du portefeuille...</p>;
  }

  return (
    <div className="space-y-6">
      {featuredProject && (
        <Card className="overflow-hidden border-accent/40 bg-gradient-to-br from-accent/15 to-transparent">
          <CardContent className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-accent">{featuredProject.status === "ongoing" ? "En cours" : "Prochainement"}</p>
              <h2 className="text-2xl font-bold">
                {featuredProject.project.icon && <span className="mr-2">{featuredProject.project.icon}</span>}
                {featuredProject.project.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {featuredProject.status === "ongoing"
                  ? `${formatDate(featuredProject.project.start_date)} → ${formatDate(featuredProject.project.end_date)}`
                  : `${formatDate(featuredProject.project.start_date)} · dans ${differenceInCalendarDays(parseISO(featuredProject.project.start_date!), new Date())} jours`}
              </p>
            </div>
            <Link to={`/projects/${featuredProject.project.id}`}>
              <Badge variant="accent" className="flex items-center gap-1 px-3 py-1.5 text-sm">
                Voir le projet <ArrowRight className="h-3.5 w-3.5" />
              </Badge>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={FolderKanban} label="Projets actifs" value={String(metrics.activeProjects)} />
        <MetricCard icon={CalendarClock} label="Jours planifiés" value={`${metrics.daysPlanned} j`} />
        <MetricCard icon={ListChecks} label="Tâches ouvertes" value={String(metrics.openTasks)} />
        <MetricCard icon={ReceiptText} label="Dépenses à valider" value={String(pendingExpensesCount ?? 0)} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Catégories de projets</h2>
        {categoryLayout === "list" && <CategoryListLayout stats={categoryStats} />}
        {categoryLayout === "grid" && <CategoryGridLayout stats={categoryStats} />}
        {categoryLayout === "circle" && <CategoryCircleLayout stats={categoryStats} />}
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof CalendarClock; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="rounded-md bg-accent/15 p-2 text-accent">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
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
          <Card className="transition-shadow hover:shadow-md">
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
          <Card className="h-full transition-shadow hover:shadow-md">
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

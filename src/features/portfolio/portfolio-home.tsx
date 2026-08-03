import { useMemo } from "react";
import { Link } from "react-router-dom";
import { differenceInCalendarDays, differenceInDays, isFuture, parseISO } from "date-fns";
import { useCategories } from "@/features/portfolio/use-categories";
import { useProjects } from "@/features/projects/use-projects";
import { useTodos } from "@/features/todos/use-todos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CalendarClock, Wallet, ListChecks, ArrowRight } from "lucide-react";

export function PortfolioHome() {
  const { data: categories, isLoading: loadingCategories } = useCategories();
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const { data: todos } = useTodos();

  const activeCategories = useMemo(() => (categories ?? []).filter((c) => c.status === "active"), [categories]);

  const nextEvent = useMemo(() => {
    return (projects ?? [])
      .filter((p) => p.start_date && isFuture(parseISO(p.start_date)))
      .sort((a, b) => parseISO(a.start_date!).getTime() - parseISO(b.start_date!).getTime())[0];
  }, [projects]);

  const metrics = useMemo(() => {
    const budgetEngaged = (projects ?? []).reduce((sum, p) => sum + (p.budget_actual ?? p.budget_planned ?? 0), 0);
    const daysPlanned = (projects ?? [])
      .filter((p) => p.status === "active" || p.status === "upcoming")
      .reduce((sum, p) => {
        if (!p.start_date || !p.end_date) return sum;
        return sum + Math.max(0, differenceInDays(parseISO(p.end_date), parseISO(p.start_date)));
      }, 0);
    const openTasks = (todos ?? []).filter((t) => !t.done).length;
    return { budgetEngaged, daysPlanned, openTasks };
  }, [projects, todos]);

  const projectsByCategory = useMemo(() => {
    const map = new Map<string, typeof projects>();
    for (const p of projects ?? []) {
      const list = map.get(p.category_id) ?? [];
      list.push(p);
      map.set(p.category_id, list as typeof projects);
    }
    return map;
  }, [projects]);

  if (loadingCategories || loadingProjects) {
    return <p className="text-muted-foreground">Chargement du portefeuille...</p>;
  }

  return (
    <div className="space-y-6">
      {nextEvent && (
        <Card className="overflow-hidden border-accent/40 bg-gradient-to-br from-accent/15 to-transparent">
          <CardContent className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-accent">Prochainement</p>
              <h2 className="text-2xl font-bold">{nextEvent.title}</h2>
              <p className="text-sm text-muted-foreground">
                {formatDate(nextEvent.start_date)} · dans {differenceInCalendarDays(parseISO(nextEvent.start_date!), new Date())} jours
              </p>
            </div>
            <Link to={`/projects/${nextEvent.id}`}>
              <Badge variant="accent" className="flex items-center gap-1 px-3 py-1.5 text-sm">
                Voir le projet <ArrowRight className="h-3.5 w-3.5" />
              </Badge>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={Wallet} label="Budget engagé" value={formatCurrency(metrics.budgetEngaged, "EUR")} />
        <MetricCard icon={CalendarClock} label="Jours planifiés" value={`${metrics.daysPlanned} j`} />
        <MetricCard icon={ListChecks} label="Tâches ouvertes" value={String(metrics.openTasks)} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Catégories de projets</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeCategories.map((category) => {
            const catProjects = projectsByCategory.get(category.id) ?? [];
            const hasActive = catProjects.some((p) => p.status === "active");
            const hasUpcoming = catProjects.some((p) => p.status === "upcoming");
            return (
              <Link key={category.id} to={`/categories/${category.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md" style={{ borderTopColor: category.color, borderTopWidth: 3 }}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-base">{category.name}</CardTitle>
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {catProjects.length} projet{catProjects.length !== 1 ? "s" : ""}
                    </p>
                    <div className="mt-2 flex gap-1">
                      {hasActive && <Badge variant="secondary">Actif</Badge>}
                      {hasUpcoming && <Badge variant="outline">À venir</Badge>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
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

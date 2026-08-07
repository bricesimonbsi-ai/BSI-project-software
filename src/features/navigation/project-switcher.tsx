import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "@/features/projects/use-projects";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ArrowLeftRight } from "lucide-react";

/** Menu de bascule rapide vers un autre projet, groupé par catégorie (celle du projet courant en
 * tête) — évite de repasser par l'accueil pour naviguer d'un projet à l'autre. */
export function ProjectSwitcher({ currentProjectId, currentCategoryId }: { currentProjectId: string; currentCategoryId?: string }) {
  const { data: projects } = useProjects();
  const navigate = useNavigate();

  const groups = useMemo(() => {
    const byCategory = new Map<string, { name: string; icon: string | null; projects: typeof projects }>();
    for (const p of projects ?? []) {
      const key = p.category_id;
      const existing = byCategory.get(key);
      if (existing) {
        existing.projects!.push(p);
      } else {
        byCategory.set(key, { name: p.categories?.name ?? "Sans catégorie", icon: p.categories?.icon ?? null, projects: [p] });
      }
    }
    const entries = Array.from(byCategory.entries());
    entries.sort(([a], [b]) => (a === currentCategoryId ? -1 : b === currentCategoryId ? 1 : 0));
    return entries;
  }, [projects, currentCategoryId]);

  if (!projects || projects.length <= 1) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" /> Changer de projet
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-72 overflow-y-auto">
        {groups.map(([categoryId, group], i) => (
          <div key={categoryId}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
              {group.icon && <span>{group.icon}</span>}
              {group.name}
            </DropdownMenuLabel>
            {group.projects!.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className={cn("flex items-center gap-1.5", p.id === currentProjectId && "bg-secondary")}
              >
                {p.icon && <span>{p.icon}</span>}
                <span className="truncate">{p.title}</span>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

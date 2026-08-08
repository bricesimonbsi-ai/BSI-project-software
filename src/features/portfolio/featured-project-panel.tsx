import { Link } from "react-router-dom";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useVoyage } from "@/features/voyages/use-voyages";
import { useProjectPeople } from "@/features/people/use-people";
import { VoyageSynthesis } from "@/features/voyages/voyage-synthesis";
import { PersonAvatarBadge } from "@/features/people/person-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { IconGlow } from "@/features/shared/icon-glow";
import type { ProjectWithCategory } from "@/features/projects/use-projects";

/** Encart "projet en avant" de la page d'accueil : au-delà du statut/dates, affiche les
 * indicateurs propres à CE projet — pour un voyage, on réutilise directement les mêmes
 * indicateurs que l'onglet Aperçu (VoyageSynthesis) plus les voyageurs avec leur avatar ; pour un
 * projet générique, les quelques champs budget/dates déjà saisis. */
export function FeaturedProjectPanel({ project, status }: { project: ProjectWithCategory; status: "ongoing" | "upcoming" }) {
  const isVoyage = project.categories?.module_key === "voyages";

  return (
    <Card className="overflow-hidden border-accent/40 bg-gradient-to-br from-accent/15 to-transparent">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">{status === "ongoing" ? "En cours" : "Prochainement"}</p>
            <h2 className="flex items-center gap-2 text-2xl font-bold">
              {project.icon && (
                <IconGlow>
                  <span>{project.icon}</span>
                </IconGlow>
              )}
              {project.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {status === "ongoing"
                ? `${formatDate(project.start_date)} → ${formatDate(project.end_date)}`
                : `${formatDate(project.start_date)} · dans ${differenceInCalendarDays(parseISO(project.start_date!), new Date())} jours`}
            </p>
          </div>
          <Link to={`/projects/${project.id}`}>
            <Badge variant="accent" className="flex items-center gap-1 px-3 py-1.5 text-sm">
              Voir le projet <ArrowRight className="h-3.5 w-3.5" />
            </Badge>
          </Link>
        </div>

        {isVoyage ? <FeaturedVoyageStats projectId={project.id} /> : <FeaturedGenericStats project={project} />}
      </CardContent>
    </Card>
  );
}

function FeaturedVoyageStats({ projectId }: { projectId: string }) {
  const { data: voyage } = useVoyage(projectId);
  const { data: linkedPeople } = useProjectPeople(projectId);

  if (!voyage) return null;
  const travelerCount = linkedPeople?.length || 1;

  return (
    <div className="space-y-3">
      {linkedPeople && linkedPeople.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {linkedPeople.map((l, i) => (
            <div key={l.id} className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 py-1 pl-1 pr-2.5">
              <PersonAvatarBadge
                name={l.people.name}
                avatarEmoji={l.people.avatar_emoji}
                avatarConfig={l.people.avatar_config}
                personId={l.people.id}
                index={i}
                className="h-6 w-6 text-xs"
              />
              <span className="text-xs font-medium">{l.people.name}</span>
            </div>
          ))}
        </div>
      )}
      <VoyageSynthesis
        voyageId={voyage.id}
        referenceCurrency={voyage.reference_currency}
        travelStyle={voyage.travel_style ?? "standard"}
        travelerCount={travelerCount}
        lodgingCount={voyage.lodging_count ?? travelerCount}
      />
    </div>
  );
}

function FeaturedGenericStats({ project }: { project: ProjectWithCategory }) {
  const cards = [
    project.start_date && { label: "Début", value: formatDate(project.start_date) },
    project.end_date && { label: "Fin", value: formatDate(project.end_date) },
    project.budget_planned != null && { label: "Budget prévisionnel", value: formatCurrency(project.budget_planned, project.currency) },
    project.budget_actual != null && { label: "Budget réel", value: formatCurrency(project.budget_actual, project.currency) },
  ].filter((c): c is { label: string; value: string } => !!c);

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-3">
            <p className="text-lg font-bold leading-tight">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

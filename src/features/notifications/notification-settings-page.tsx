import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useProjects, type ProjectWithCategory } from "@/features/projects/use-projects";
import { useNotificationTypePreferences, useSetNotificationTypePreference } from "@/features/notifications/use-notification-preferences";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type NotificationTypeConfig = {
  key: string;
  label: string;
  appliesTo: (moduleKey: string | null) => boolean;
  comingSoon?: boolean;
};

const NOTIFICATION_TYPES: NotificationTypeConfig[] = [
  { key: "journal_reaction", label: "Nouvelle réaction sur une publication du journal", appliesTo: (m) => m === "voyages" },
  { key: "journal_comment", label: "Nouveau commentaire sur une publication du journal", appliesTo: (m) => m === "voyages" },
  { key: "todo_assigned", label: "Nouvelle tâche assignée", appliesTo: () => true },
  {
    key: "media_new_release",
    label: "Nouveautés cinéma, séries et jeux vidéo",
    appliesTo: (m) => m === "media",
    comingSoon: true,
  },
];

type CategoryGroup = { name: string; icon: string | null; moduleKey: string | null; projects: ProjectWithCategory[] };

/**
 * Administration en libre-service des notifications, par type et par projet — pour ne plus avoir
 * à demander une exception au cas par cas. Absence de réglage = notification active (comportement
 * par défaut), inchangé pour tout ce qui n'a jamais été touché ici.
 */
export function NotificationSettingsPage() {
  const { data: projects } = useProjects();
  const { data: preferences } = useNotificationTypePreferences();
  const setPreference = useSetNotificationTypePreference();

  const categories = useMemo(() => {
    const map = new Map<string, CategoryGroup>();
    for (const p of projects ?? []) {
      const existing = map.get(p.category_id);
      if (existing) existing.projects.push(p);
      else
        map.set(p.category_id, {
          name: p.categories?.name ?? "Catégorie",
          icon: p.categories?.icon ?? null,
          moduleKey: p.categories?.module_key ?? null,
          projects: [p],
        });
    }
    return [...map.values()];
  }, [projects]);

  function isEnabled(type: string, projectId: string): boolean {
    const row = preferences?.find((p) => p.notification_type === type && p.project_id === projectId);
    return row ? row.enabled : true;
  }

  function toggle(type: string, projectId: string, next: boolean) {
    setPreference.mutate({ notificationType: type, projectId, enabled: next });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/settings">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Notifications</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Choisis quelles notifications tu reçois, projet par projet. Par défaut, tout est activé.
      </p>

      {categories.length === 0 && <p className="text-sm text-muted-foreground">Aucun projet pour l'instant.</p>}

      {categories.map((cat) => {
        const applicableTypes = NOTIFICATION_TYPES.filter((t) => t.appliesTo(cat.moduleKey));
        if (applicableTypes.length === 0) return null;
        return (
          <Card key={cat.name}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {cat.icon && <span>{cat.icon}</span>} {cat.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {applicableTypes.map((type) => {
                const allEnabled = cat.projects.every((p) => isEnabled(type.key, p.id));
                return (
                  <div key={type.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{type.label}</p>
                        {type.comingSoon && (
                          <p className="text-xs text-muted-foreground">
                            Bientôt disponible — ce type de notification n'est pas encore émis.
                          </p>
                        )}
                      </div>
                      {!type.comingSoon && cat.projects.length > 1 && (
                        <Switch
                          checked={allEnabled}
                          onCheckedChange={(next) => cat.projects.forEach((p) => toggle(type.key, p.id, next))}
                          title="Tout activer/désactiver pour cette catégorie"
                        />
                      )}
                    </div>
                    {!type.comingSoon && (
                      <div className="space-y-1.5 pl-1">
                        {cat.projects.map((p) => (
                          <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                            <span className="text-muted-foreground">
                              {p.icon ? `${p.icon} ` : ""}
                              {p.title}
                            </span>
                            <Switch checked={isEnabled(type.key, p.id)} onCheckedChange={(next) => toggle(type.key, p.id, next)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

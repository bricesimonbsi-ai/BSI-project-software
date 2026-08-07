import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVoyage, useUpdateVoyage } from "@/features/voyages/use-voyages";
import { useProject, useUpdateProject, useDeleteProject } from "@/features/projects/use-projects";
import { useProjectPeople } from "@/features/people/use-people";
import { useThemeStore } from "@/features/theme/theme-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ItineraryView } from "@/features/voyages/itinerary/itinerary-view";
import { CurrencySelect } from "@/features/voyages/currency-select";
import { DocumentsPanel } from "@/features/projects/documents-panel";
import { TodoList } from "@/features/todos/todo-list";
import { CollaboratorsPanel } from "@/features/projects/collaborators-panel";
import { VoyageSynthesis } from "@/features/voyages/voyage-synthesis";
import { useItineraryDateRange } from "@/features/voyages/use-itinerary-date-range";
import { ProjectPeoplePicker } from "@/features/people/project-people-picker";
import { BudgetInsights } from "@/features/voyages/budget-insights";
import { EquipmentTab } from "@/features/voyages/equipment-tab";
import { TRAVEL_STYLE_OPTIONS } from "@/features/voyages/budget-estimate";
import { formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import type { TravelStyle } from "@/types/database";

export function VoyageDetailPage({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { data: project } = useProject(projectId);
  const { data: voyage, isLoading } = useVoyage(projectId);
  const updateVoyage = useUpdateVoyage(projectId);
  const deleteProject = useDeleteProject();
  const [deleting, setDeleting] = useState(false);
  const updateProject = useUpdateProject();
  const setAccentColor = useThemeStore((s) => s.setAccentColor);

  const { data: linkedPeople } = useProjectPeople(projectId);
  const itineraryDates = useItineraryDateRange(voyage?.id);

  const [form, setForm] = useState({
    reference_currency: "EUR",
    lodging_count: "",
    travel_style: "standard" as TravelStyle,
  });

  useEffect(() => {
    if (voyage) {
      setForm({
        reference_currency: voyage.reference_currency,
        lodging_count: voyage.lodging_count?.toString() ?? "",
        travel_style: voyage.travel_style ?? "standard",
      });
    }
    if (project?.categories?.color) setAccentColor(project.categories.color);
    return () => setAccentColor(null);
  }, [voyage, project, setAccentColor]);

  /** Les dates du voyage ne sont plus une saisie indépendante : elles suivent automatiquement
   * la première et la dernière ville de l'itinéraire (voir useItineraryDateRange). */
  useEffect(() => {
    if (!voyage) return;
    if (itineraryDates.start === voyage.start_date && itineraryDates.end === voyage.end_date) return;
    updateVoyage.mutate({ start_date: itineraryDates.start, end_date: itineraryDates.end });
    updateProject.mutate({ id: projectId, start_date: itineraryDates.start, end_date: itineraryDates.end });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voyage?.start_date, voyage?.end_date, itineraryDates.start, itineraryDates.end]);

  if (isLoading || !voyage || !project) return <p className="text-muted-foreground">Chargement...</p>;

  async function handleSaveOverview() {
    try {
      await updateVoyage.mutateAsync({
        reference_currency: form.reference_currency,
        lodging_count: form.lodging_count ? Number(form.lodging_count) : null,
        travel_style: form.travel_style,
      });
      toast({ title: "Voyage mis à jour" });
    } catch (err) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    }
  }

  async function handleDeleteVoyage() {
    if (
      !window.confirm(
        `Supprimer définitivement le voyage "${project?.title ?? ""}" ? Tout son contenu (itinéraire, dépenses, équipement, documents, tâches) sera perdu. Cette action est irréversible.`
      )
    )
      return;
    setDeleting(true);
    try {
      await deleteProject.mutateAsync(projectId);
      navigate("/");
    } catch (err) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
      setDeleting(false);
    }
  }

  // Source unique du nombre de voyageurs : la liste "Voyageurs" liée au projet (ProjectPeoplePicker
  // ci-dessous), pas des compteurs adultes/enfants séparés qu'on pouvait oublier de synchroniser
  // avec cette liste — tous les calculs prévisionnels (nourriture, transport sur place...) s'y fient.
  const travelerCount = linkedPeople?.length || 1;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Voyages</p>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(voyage.start_date)} → {formatDate(voyage.end_date)} · {travelerCount} voyageur{travelerCount > 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDeleteVoyage} disabled={deleting}>
          <Trash2 className="mr-2 h-4 w-4" /> {deleting ? "Suppression..." : "Supprimer ce voyage"}
        </Button>
      </div>

      <Tabs defaultValue="itinerary">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="itinerary">Itinéraire</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="equipment">Équipement</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="todos">Tâches</TabsTrigger>
          <TabsTrigger value="collaborators">Collaborateurs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <VoyageSynthesis
            voyageId={voyage.id}
            referenceCurrency={voyage.reference_currency}
            travelStyle={voyage.travel_style ?? "standard"}
            travelerCount={travelerCount}
            lodgingCount={voyage.lodging_count ?? travelerCount}
          />

          <Card>
            <CardContent className="space-y-2 p-5">
              <Label>Voyageurs ({travelerCount})</Label>
              <p className="text-xs text-muted-foreground">
                Nombre de voyageurs utilisé pour tous les calculs prévisionnels (nourriture, transport sur place...) : ajoute ou
                retire des personnes ici pour l'ajuster.
              </p>
              <ProjectPeoplePicker projectId={projectId} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de départ</Label>
                  <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                    {formatDate(voyage.start_date)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Date de retour</Label>
                  <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">{formatDate(voyage.end_date)}</p>
                </div>
                <div className="space-y-2">
                  <Label>Devise de référence</Label>
                  <CurrencySelect
                    value={form.reference_currency}
                    onChange={(v) => setForm({ ...form, reference_currency: v })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre de logements à prévoir</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="ex. 2 chambres"
                    value={form.lodging_count}
                    onChange={(e) => setForm({ ...form, lodging_count: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Style de voyage</Label>
                  {/* Enregistré immédiatement (pas seulement via le bouton "Enregistrer" du
                   * reste du formulaire) : ce choix pilote les estimations prévisionnelles
                   * affichées dans tout l'onglet Budget, elles doivent se recalculer sans
                   * action supplémentaire dès qu'il change. */}
                  <Select
                    value={form.travel_style}
                    onValueChange={(v) => {
                      setForm({ ...form, travel_style: v as TravelStyle });
                      updateVoyage.mutate(
                        { travel_style: v as TravelStyle },
                        { onError: (err) => toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" }) }
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRAVEL_STYLE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSaveOverview}>Enregistrer</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="itinerary" className="space-y-4">
          <ItineraryView
            voyageId={voyage.id}
            referenceCurrency={voyage.reference_currency}
            projectId={projectId}
            travelStyle={voyage.travel_style ?? "standard"}
            travelerCount={travelerCount}
            lodgingCount={voyage.lodging_count ?? travelerCount}
          />
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          <BudgetInsights voyage={voyage} projectId={projectId} />
        </TabsContent>

        <TabsContent value="equipment">
          <EquipmentTab voyageId={voyage.id} referenceCurrency={voyage.reference_currency} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsPanel projectId={projectId} />
        </TabsContent>

        <TabsContent value="todos">
          <TodoList projectId={projectId} />
        </TabsContent>

        <TabsContent value="collaborators">
          <CollaboratorsPanel projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

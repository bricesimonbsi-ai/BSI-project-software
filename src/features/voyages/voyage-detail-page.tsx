import { useEffect, useState } from "react";
import { useVoyage, useUpdateVoyage } from "@/features/voyages/use-voyages";
import { useVoyageExpenses, useVoyageBudgetSummary, PRE_DEPARTURE_CATEGORIES } from "@/features/voyages/use-expenses";
import { useProject, useUpdateProject } from "@/features/projects/use-projects";
import { useThemeStore } from "@/features/theme/theme-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ItineraryView } from "@/features/voyages/itinerary/itinerary-view";
import { ExpenseFormDialog } from "@/features/voyages/expense-form-dialog";
import { ExpenseList } from "@/features/voyages/expense-list";
import { DocumentsPanel } from "@/features/projects/documents-panel";
import { TodoList } from "@/features/todos/todo-list";
import { CollaboratorsPanel } from "@/features/projects/collaborators-panel";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function VoyageDetailPage({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const { data: voyage, isLoading } = useVoyage(projectId);
  const updateVoyage = useUpdateVoyage(projectId);
  const updateProject = useUpdateProject();
  const setAccentColor = useThemeStore((s) => s.setAccentColor);

  const { data: preDepartureExpenses } = useVoyageExpenses(voyage?.id);
  const { data: budgetSummary } = useVoyageBudgetSummary(voyage?.id);

  const [form, setForm] = useState({ start_date: "", end_date: "", adults_count: "1", children_count: "0", reference_currency: "EUR" });

  useEffect(() => {
    if (voyage) {
      setForm({
        start_date: voyage.start_date ?? "",
        end_date: voyage.end_date ?? "",
        adults_count: String(voyage.adults_count),
        children_count: String(voyage.children_count),
        reference_currency: voyage.reference_currency,
      });
    }
    if (project?.categories?.color) setAccentColor(project.categories.color);
    return () => setAccentColor(null);
  }, [voyage, project, setAccentColor]);

  if (isLoading || !voyage || !project) return <p className="text-muted-foreground">Chargement...</p>;

  async function handleSaveOverview() {
    try {
      await updateVoyage.mutateAsync({
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        adults_count: Number(form.adults_count),
        children_count: Number(form.children_count),
        reference_currency: form.reference_currency,
      });
      await updateProject.mutateAsync({ id: projectId, start_date: form.start_date || null, end_date: form.end_date || null });
      toast({ title: "Voyage mis à jour" });
    } catch (err) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    }
  }

  const preDepartureTotal = preDepartureExpenses?.reduce(
    (sum, e) => sum + e.amount * e.manual_rate_to_reference,
    0
  ) ?? 0;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Voyages</p>
        <h1 className="text-2xl font-bold">{project.title}</h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(voyage.start_date)} → {formatDate(voyage.end_date)} · {voyage.adults_count} adulte(s)
          {voyage.children_count > 0 ? `, ${voyage.children_count} enfant(s)` : ""}
        </p>
      </div>

      <Tabs defaultValue="itinerary">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="itinerary">Itinéraire</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="todos">Tâches</TabsTrigger>
          <TabsTrigger value="collaborators">Collaborateurs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de départ</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Date de retour</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Adultes</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.adults_count}
                    onChange={(e) => setForm({ ...form, adults_count: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Enfants</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.children_count}
                    onChange={(e) => setForm({ ...form, children_count: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Devise de référence</Label>
                  <Input
                    value={form.reference_currency}
                    maxLength={3}
                    onChange={(e) => setForm({ ...form, reference_currency: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
              <Button onClick={handleSaveOverview}>Enregistrer</Button>

              <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Budget prévisionnel total</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(budgetSummary?.total_planned ?? 0, voyage.reference_currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dépenses réelles totales</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(budgetSummary?.total_actual ?? 0, voyage.reference_currency)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="itinerary" className="space-y-4">
          <ItineraryView voyageId={voyage.id} referenceCurrency={voyage.reference_currency} />
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Catégories avant-départ</p>
                  <p className="text-xs text-muted-foreground">
                    Total : {formatCurrency(preDepartureTotal, voyage.reference_currency)}
                  </p>
                </div>
                <ExpenseFormDialog
                  scope={{ voyageId: voyage.id }}
                  categories={PRE_DEPARTURE_CATEGORIES}
                  referenceCurrency={voyage.reference_currency}
                  invalidateKey={["voyage-expenses", voyage.id]}
                />
              </div>
              <ExpenseList expenses={preDepartureExpenses ?? []} invalidateKey={["voyage-expenses", voyage.id]} />
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            Les dépenses sur place (logement, nourriture, activités, transport local) se saisissent depuis chaque ville dans
            l'onglet Itinéraire.
          </p>
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

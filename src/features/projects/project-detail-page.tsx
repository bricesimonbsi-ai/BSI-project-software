import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useProject, useUpdateProject } from "@/features/projects/use-projects";
import { useThemeStore } from "@/features/theme/theme-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TodoList } from "@/features/todos/todo-list";
import { DocumentsPanel } from "@/features/projects/documents-panel";
import { CollaboratorsPanel } from "@/features/projects/collaborators-panel";
import { EmojiPickerButton } from "@/features/shared/emoji-picker";
import { toast } from "@/hooks/use-toast";

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading } = useProject(projectId);
  const updateProject = useUpdateProject();
  const setAccentColor = useThemeStore((s) => s.setAccentColor);

  const [form, setForm] = useState({
    title: "",
    description: "",
    start_date: "",
    end_date: "",
    budget_planned: "",
    budget_actual: "",
  });

  useEffect(() => {
    if (project) {
      setForm({
        title: project.title,
        description: project.description ?? "",
        start_date: project.start_date ?? "",
        end_date: project.end_date ?? "",
        budget_planned: project.budget_planned?.toString() ?? "",
        budget_actual: project.budget_actual?.toString() ?? "",
      });
      if (project.categories?.color) setAccentColor(project.categories.color);
    }
    return () => setAccentColor(null);
  }, [project, setAccentColor]);

  if (isLoading || !project) return <p className="text-muted-foreground">Chargement...</p>;

  async function handleSave() {
    if (!projectId) return;
    try {
      await updateProject.mutateAsync({
        id: projectId,
        title: form.title,
        description: form.description || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budget_planned: form.budget_planned ? Number(form.budget_planned) : null,
        budget_actual: form.budget_actual ? Number(form.budget_actual) : null,
      });
      toast({ title: "Projet mis à jour" });
    } catch (err) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">{project.categories?.name}</p>
        <div className="flex items-center gap-2">
          <EmojiPickerButton
            value={project.icon}
            onChange={(icon) => updateProject.mutate({ id: project.id, icon })}
          />
          <h1 className="text-2xl font-bold">{project.title}</h1>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Détails</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="todos">Tâches</TabsTrigger>
          <TabsTrigger value="collaborators">Collaborateurs</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de début</Label>
                  <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Date de fin</Label>
                  <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <Button onClick={handleSave}>Enregistrer</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Budget prévisionnel</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.budget_planned}
                    onChange={(e) => setForm({ ...form, budget_planned: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Budget réel</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.budget_actual}
                    onChange={(e) => setForm({ ...form, budget_actual: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleSave}>Enregistrer</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsPanel projectId={project.id} />
        </TabsContent>

        <TabsContent value="todos">
          <TodoList projectId={project.id} />
        </TabsContent>

        <TabsContent value="collaborators">
          <CollaboratorsPanel projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

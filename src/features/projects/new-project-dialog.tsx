import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useCreateProject, useProjects } from "@/features/projects/use-projects";
import { copyShoppingListItems } from "@/features/shopping/use-shopping-list";
import { EmojiPickerButton } from "@/features/shared/emoji-picker";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Category } from "@/types/database";
import { Plus } from "lucide-react";

export function NewProjectDialog({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetPlanned, setBudgetPlanned] = useState("");
  const [copyFromId, setCopyFromId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);
  const createProject = useCreateProject();
  const { data: projects } = useProjects();
  const navigate = useNavigate();
  const isVoyage = category.module_key === "voyages";
  const isCourses = category.module_key === "courses";
  const isMedia = category.module_key === "media";
  const hidesDates = isCourses || isMedia;
  const hidesBudget = isVoyage || isCourses || isMedia;

  const existingLists = (projects ?? []).filter((p) => p.category_id === category.id);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const project = await createProject.mutateAsync({
        category_id: category.id,
        title,
        icon,
        description: description || undefined,
        start_date: hidesDates ? null : startDate || null,
        end_date: hidesDates ? null : endDate || null,
        budget_planned: hidesBudget ? null : budgetPlanned ? Number(budgetPlanned) : null,
      });

      if (isVoyage) {
        const { error } = await supabase.from("voyages").insert({
          project_id: project.id,
          start_date: startDate || null,
          end_date: endDate || null,
        });
        if (error) throw error;
      }

      if (isCourses && copyFromId !== "none") {
        await copyShoppingListItems(copyFromId, project.id);
      }

      setOpen(false);
      setTitle("");
      setIcon(null);
      setDescription("");
      setStartDate("");
      setEndDate("");
      setBudgetPlanned("");
      setCopyFromId("none");
      navigate(`/projects/${project.id}`);
    } catch (err) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nouveau projet
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau projet — {category.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre</Label>
            <div className="flex gap-2">
              <EmojiPickerButton value={icon} onChange={setIcon} />
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {isCourses && existingLists.length > 0 && (
            <div className="space-y-2">
              <Label>Repartir d'une liste existante (optionnel)</Label>
              <Select value={copyFromId} onValueChange={setCopyFromId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Liste vide</SelectItem>
                  {existingLists.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.icon ? `${p.icon} ` : ""}
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!hidesDates && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Date de début</Label>
                <Input id="start_date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Date de fin</Label>
                <Input id="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          )}
          {!hidesBudget && (
            <div className="space-y-2">
              <Label htmlFor="budget_planned">Budget prévisionnel</Label>
              <Input
                id="budget_planned"
                type="number"
                min="0"
                step="0.01"
                value={budgetPlanned}
                onChange={(e) => setBudgetPlanned(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Création..." : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateProject } from "@/features/projects/use-projects";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Category } from "@/types/database";
import { Plus } from "lucide-react";

export function NewProjectDialog({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetPlanned, setBudgetPlanned] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createProject = useCreateProject();
  const navigate = useNavigate();
  const isVoyage = category.module_key === "voyages";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const project = await createProject.mutateAsync({
        category_id: category.id,
        title,
        description: description || undefined,
        start_date: startDate || null,
        end_date: endDate || null,
        budget_planned: budgetPlanned ? Number(budgetPlanned) : null,
      });

      if (isVoyage) {
        const { error } = await supabase.from("voyages").insert({
          project_id: project.id,
          start_date: startDate || null,
          end_date: endDate || null,
        });
        if (error) throw error;
      }

      setOpen(false);
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setBudgetPlanned("");
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
            <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
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
          {!isVoyage && (
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

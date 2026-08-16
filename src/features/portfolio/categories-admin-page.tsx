import { useState, useEffect, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/providers/auth-provider";
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from "@/features/portfolio/use-categories";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { EmojiPickerButton } from "@/features/shared/emoji-picker";
import { Plus, FolderOpen, Trash2 } from "lucide-react";
import type { Category } from "@/types/database";

export function CategoriesAdminPage() {
  const { profile } = useAuth();
  const { data: categories, isLoading } = useCategories();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  async function handleDelete(category: Category) {
    if (!window.confirm(`Supprimer définitivement la catégorie "${category.name}" ? Cette action est irréversible.`)) return;
    try {
      await deleteCategory.mutateAsync(category.id);
    } catch {
      toast({
        title: "Suppression impossible",
        description: `Cette catégorie contient encore des projets — déplace-les ou supprime-les d'abord (bouton "Projets" ci-dessus).`,
        variant: "destructive",
      });
    }
  }

  if (!profile?.is_admin) {
    return <p className="text-muted-foreground">Seul l'administrateur peut gérer les catégories.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Catégories de projets</h1>
        <NewCategoryDialog nextPosition={(categories?.length ?? 0)} />
      </div>

      {isLoading && <p className="text-muted-foreground">Chargement...</p>}

      <div className="space-y-2">
        {categories?.map((category) => (
          <Card key={category.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <input
                  type="color"
                  value={category.color}
                  onChange={(e) => updateCategory.mutate({ id: category.id, color: e.target.value })}
                  className="h-8 w-8 flex-shrink-0 cursor-pointer rounded border-0"
                  title="Couleur d'accent"
                />
                <EmojiPickerButton
                  value={category.icon}
                  onChange={(icon) => updateCategory.mutate({ id: category.id, icon })}
                  className="h-8 w-8 flex-shrink-0"
                />
                <div className="min-w-0">
                  <CategoryNameInput category={category} updateCategory={updateCategory} />
                  {category.module_key && <p className="truncate text-xs text-muted-foreground">Module dédié : {category.module_key}</p>}
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <Badge variant={category.status === "active" ? "secondary" : "outline"}>
                  {category.status === "active" ? "Active" : "Archivée"}
                </Badge>
                <Button variant="ghost" size="sm" asChild title="Voir les projets de cette catégorie, même archivée">
                  <Link to={`/categories/${category.id}`}>
                    <FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Projets
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateCategory.mutate({
                      id: category.id,
                      status: category.status === "active" ? "archived" : "active",
                    })
                  }
                >
                  {category.status === "active" ? "Archiver" : "Réactiver"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(category)}
                  title="Supprimer la catégorie"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** Renommage en ligne (édite au clic, enregistre à la perte de focus ou sur Entrée) — même
 * principe que les autres champs modifiables au fil de l'eau dans l'application (pas de bouton
 * "Enregistrer" séparé pour un simple texte). Le nom est unique en base (contrainte SQL) : une
 * erreur de doublon remonte via le toast générique déjà branché sur useUpdateCategory. */
function CategoryNameInput({ category, updateCategory }: { category: Category; updateCategory: ReturnType<typeof useUpdateCategory> }) {
  const [value, setValue] = useState(category.name);

  useEffect(() => setValue(category.name), [category.name]);

  function commit() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === category.name) {
      setValue(category.name);
      return;
    }
    updateCategory.mutate({ id: category.id, name: trimmed });
  }

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className="h-8 w-full min-w-0 max-w-[12rem] border-transparent bg-transparent px-1.5 font-medium hover:border-border focus-visible:border-border"
    />
  );
}

function NewCategoryDialog({ nextPosition }: { nextPosition: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#64748b");
  const [icon, setIcon] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const createCategory = useCreateCategory();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createCategory.mutateAsync({ name, color, icon, position: nextPosition });
      setOpen(false);
      setName("");
      setColor("#64748b");
      setIcon(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nouvelle catégorie
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle catégorie</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nom</Label>
            <Input id="cat-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex gap-4">
            <div className="space-y-2">
              <Label htmlFor="cat-color">Couleur d'accent</Label>
              <input
                id="cat-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 cursor-pointer rounded border-0"
              />
            </div>
            <div className="space-y-2">
              <Label>Icône</Label>
              <EmojiPickerButton value={icon} onChange={setIcon} className="h-10 w-10 text-xl" />
            </div>
          </div>
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

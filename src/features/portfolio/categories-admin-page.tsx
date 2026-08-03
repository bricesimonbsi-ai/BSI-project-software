import { useState, type FormEvent } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { useCategories, useCreateCategory, useUpdateCategory } from "@/features/portfolio/use-categories";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export function CategoriesAdminPage() {
  const { profile } = useAuth();
  const { data: categories, isLoading } = useCategories();
  const updateCategory = useUpdateCategory();

  if (!profile?.is_admin) {
    return <p className="text-muted-foreground">Seul l'administrateur peut gérer les catégories.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catégories de projets</h1>
        <NewCategoryDialog nextPosition={(categories?.length ?? 0)} />
      </div>

      {isLoading && <p className="text-muted-foreground">Chargement...</p>}

      <div className="space-y-2">
        {categories?.map((category) => (
          <Card key={category.id}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={category.color}
                  onChange={(e) => updateCategory.mutate({ id: category.id, color: e.target.value })}
                  className="h-8 w-8 cursor-pointer rounded border-0"
                  title="Couleur d'accent"
                />
                <div>
                  <p className="font-medium">{category.name}</p>
                  {category.module_key && <p className="text-xs text-muted-foreground">Module dédié : {category.module_key}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={category.status === "active" ? "secondary" : "outline"}>
                  {category.status === "active" ? "Active" : "Archivée"}
                </Badge>
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewCategoryDialog({ nextPosition }: { nextPosition: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#64748b");
  const [submitting, setSubmitting] = useState(false);
  const createCategory = useCreateCategory();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createCategory.mutateAsync({ name, color, position: nextPosition });
      setOpen(false);
      setName("");
      setColor("#64748b");
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

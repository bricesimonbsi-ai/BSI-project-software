import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useProject, useUpdateProject, useDeleteProject } from "@/features/projects/use-projects";
import { useThemeStore } from "@/features/theme/theme-store";
import {
  useShoppingListItems,
  useAddShoppingItem,
  useToggleShoppingItem,
  useUpdateShoppingItem,
  useDeleteShoppingItem,
} from "@/features/shopping/use-shopping-list";
import { suggestFoodIcon } from "@/features/shopping/food-icons";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CollaboratorsPanel } from "@/features/projects/collaborators-panel";
import { EmojiPickerButton } from "@/features/shared/emoji-picker";
import { Breadcrumb } from "@/features/navigation/breadcrumb";
import { ProjectSwitcher } from "@/features/navigation/project-switcher";
import { PageHeroCard } from "@/features/shared/page-hero-card";
import { IconGlow } from "@/features/shared/icon-glow";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";
import type { ShoppingListItem } from "@/types/database";

export function ShoppingListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const [deleting, setDeleting] = useState(false);
  const setAccentColor = useThemeStore((s) => s.setAccentColor);

  useEffect(() => {
    if (project?.categories?.color) setAccentColor(project.categories.color);
    return () => setAccentColor(null);
  }, [project, setAccentColor]);

  if (isLoading || !project || !projectId) return <p className="text-muted-foreground">Chargement...</p>;

  async function handleDelete() {
    if (!window.confirm(`Supprimer définitivement la liste "${project?.title ?? ""}" ? Cette action est irréversible.`)) return;
    setDeleting(true);
    try {
      await deleteProject.mutateAsync(project!.id);
      navigate("/");
    } catch (err) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeroCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb
            items={[
              { label: "Accueil", to: "/" },
              { label: project.categories?.name ?? "Catégorie", to: `/categories/${project.category_id}`, icon: project.categories?.icon },
              { label: project.title, icon: project.icon },
            ]}
          />
          <ProjectSwitcher currentProjectId={project.id} currentCategoryId={project.category_id} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconGlow>
              <EmojiPickerButton value={project.icon} onChange={(icon) => updateProject.mutate({ id: project.id, icon })} />
            </IconGlow>
            <h1 className="text-2xl font-bold">{project.title}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="mr-2 h-4 w-4" /> {deleting ? "Suppression..." : "Supprimer cette liste"}
          </Button>
        </div>
      </PageHeroCard>

      <Tabs defaultValue="liste">
        <TabsList>
          <TabsTrigger value="liste">Liste</TabsTrigger>
          <TabsTrigger value="collaborators">Collaborateurs</TabsTrigger>
        </TabsList>

        <TabsContent value="liste">
          <ShoppingListItems projectId={projectId} />
        </TabsContent>

        <TabsContent value="collaborators">
          <CollaboratorsPanel projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ShoppingListItems({ projectId }: { projectId: string }) {
  const { data: items, isLoading } = useShoppingListItems(projectId);
  const addItem = useAddShoppingItem(projectId);
  const toggleItem = useToggleShoppingItem(projectId);
  const updateItem = useUpdateShoppingItem(projectId);
  const deleteItem = useDeleteShoppingItem(projectId);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [icon, setIcon] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await addItem.mutateAsync({ name: name.trim(), quantity: quantity.trim() || null, icon });
    setName("");
    setQuantity("");
    setIcon(null);
  }

  if (isLoading) return <p className="py-6 text-sm text-muted-foreground">Chargement...</p>;

  const pending = (items ?? []).filter((i) => !i.checked);
  const bought = (items ?? []).filter((i) => i.checked);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
            <EmojiPickerButton value={icon ?? (name.trim() ? suggestFoodIcon(name) : null)} onChange={setIcon} />
            <Input
              placeholder="Article (ex. Lait, Pommes...)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-[10rem] flex-1"
            />
            <Input
              placeholder="Quantité"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-28 flex-shrink-0"
            />
            <Button type="submit" disabled={!name.trim() || addItem.isPending}>
              <Plus className="mr-1.5 h-4 w-4" /> Ajouter
            </Button>
          </form>
        </CardContent>
      </Card>

      {(items ?? []).length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Liste vide — ajoute ton premier article.</p>
      ) : (
        <div className="space-y-1">
          {pending.map((item) => (
            <ShoppingItemRow
              key={item.id}
              item={item}
              onToggle={(checked) => toggleItem.mutate({ id: item.id, checked })}
              onQuantityChange={(quantity) => updateItem.mutate({ id: item.id, quantity: quantity || null })}
              onDelete={() => deleteItem.mutate(item.id)}
            />
          ))}

          {bought.length > 0 && (
            <div className="space-y-1 pt-3">
              <p className="text-xs font-medium text-muted-foreground">Déjà acheté ({bought.length})</p>
              {bought.map((item) => (
                <ShoppingItemRow
                  key={item.id}
                  item={item}
                  onToggle={(checked) => toggleItem.mutate({ id: item.id, checked })}
                  onQuantityChange={(quantity) => updateItem.mutate({ id: item.id, quantity: quantity || null })}
                  onDelete={() => deleteItem.mutate(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShoppingItemRow({
  item,
  onToggle,
  onQuantityChange,
  onDelete,
}: {
  item: ShoppingListItem;
  onToggle: (checked: boolean) => void;
  onQuantityChange: (quantity: string) => void;
  onDelete: () => void;
}) {
  const [quantity, setQuantity] = useState(item.quantity ?? "");

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
      <Checkbox checked={item.checked} onCheckedChange={(checked) => onToggle(!!checked)} />
      <span className="text-lg">{item.icon ?? "🛒"}</span>
      <span className={item.checked ? "flex-1 truncate text-sm text-muted-foreground line-through" : "flex-1 truncate text-sm"}>
        {item.name}
      </span>
      <Input
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        onBlur={() => quantity !== (item.quantity ?? "") && onQuantityChange(quantity)}
        placeholder="Qté"
        className="h-8 w-20 flex-shrink-0 text-xs"
      />
      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

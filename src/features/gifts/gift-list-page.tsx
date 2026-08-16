import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useProject, useUpdateProject, useDeleteProject } from "@/features/projects/use-projects";
import { ProjectTitleInput } from "@/features/projects/project-title-input";
import { useThemeStore } from "@/features/theme/theme-store";
import { usePeople } from "@/features/people/use-people";
import { PersonAvatarBadge } from "@/features/people/person-avatar";
import {
  useGiftItems,
  useCreateGiftItem,
  useUpdateGiftItem,
  useDeleteGiftItem,
} from "@/features/gifts/use-gift-list";
import { GIFT_OCCASION_LABELS, GIFT_STATUS_LABELS, nextGiftStatus } from "@/features/gifts/gift-constants";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { CollaboratorsPanel } from "@/features/projects/collaborators-panel";
import { EmojiPickerButton } from "@/features/shared/emoji-picker";
import { Breadcrumb } from "@/features/navigation/breadcrumb";
import { ProjectSwitcher } from "@/features/navigation/project-switcher";
import { PageHeroCard } from "@/features/shared/page-hero-card";
import { IconGlow } from "@/features/shared/icon-glow";
import { toast } from "@/hooks/use-toast";
import { Trash2, Plus, ExternalLink } from "lucide-react";
import type { GiftItem, GiftOccasion } from "@/types/database";

const NONE = "none";

export function GiftListPage() {
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
            <ProjectTitleInput projectId={project.id} title={project.title} />
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
          <GiftItems projectId={projectId} />
        </TabsContent>

        <TabsContent value="collaborators">
          <CollaboratorsPanel projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GiftItems({ projectId }: { projectId: string }) {
  const { data: items, isLoading } = useGiftItems(projectId);
  const { data: people } = usePeople();
  const createItem = useCreateGiftItem(projectId);
  const updateItem = useUpdateGiftItem(projectId);
  const deleteItem = useDeleteGiftItem(projectId);

  const [title, setTitle] = useState("");
  const [personId, setPersonId] = useState(NONE);
  const [occasion, setOccasion] = useState<GiftOccasion>("anniversaire");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createItem.mutateAsync({
      title: title.trim(),
      person_id: personId === NONE ? null : personId,
      occasion,
      price_estimate: null,
      link: null,
      notes: null,
    });
    setTitle("");
  }

  const peopleById = useMemo(() => new Map((people ?? []).map((p) => [p.id, p])), [people]);

  const groups = useMemo(() => {
    const byPerson = new Map<string, GiftItem[]>();
    for (const item of items ?? []) {
      const key = item.person_id ?? NONE;
      if (!byPerson.has(key)) byPerson.set(key, []);
      byPerson.get(key)!.push(item);
    }
    const entries = [...byPerson.entries()].map(([personKey, groupItems]) => ({
      person: personKey === NONE ? null : peopleById.get(personKey) ?? null,
      items: groupItems,
    }));
    entries.sort((a, b) => {
      if (!a.person) return 1;
      if (!b.person) return -1;
      return a.person.name.localeCompare(b.person.name);
    });
    return entries;
  }, [items, peopleById]);

  if (isLoading) return <p className="py-6 text-sm text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Idée de cadeau (ex. Casque audio)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-w-[10rem] flex-1"
            />
            <Button type="submit" disabled={!title.trim() || createItem.isPending}>
              <Plus className="mr-1.5 h-4 w-4" /> Ajouter
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Pour qui ?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Personne (optionnel)</SelectItem>
                {(people ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={occasion} onValueChange={(v) => setOccasion(v as GiftOccasion)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(GIFT_OCCASION_LABELS) as GiftOccasion[]).map((o) => (
                  <SelectItem key={o} value={o}>
                    {GIFT_OCCASION_LABELS[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {(items ?? []).length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Liste vide — ajoute ta première idée de cadeau.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.person?.id ?? NONE} className="space-y-2">
              <div className="flex items-center gap-2">
                {group.person ? (
                  <PersonAvatarBadge
                    name={group.person.name}
                    avatarEmoji={group.person.avatar_emoji}
                    avatarConfig={group.person.avatar_config}
                    personId={group.person.id}
                    colorIndex={group.person.color_index}
                    index={0}
                    className="h-6 w-6 text-xs"
                  />
                ) : null}
                <p className="text-xs font-medium text-muted-foreground">{group.person?.name ?? "Sans destinataire"}</p>
              </div>
              {group.items.map((item) => (
                <GiftItemRow
                  key={item.id}
                  item={item}
                  onCycleStatus={() => updateItem.mutate({ id: item.id, status: nextGiftStatus(item.status) })}
                  onUpdate={(patch) => updateItem.mutate({ id: item.id, ...patch })}
                  onDelete={() => deleteItem.mutate(item.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GiftItemRow({
  item,
  onCycleStatus,
  onUpdate,
  onDelete,
}: {
  item: GiftItem;
  onCycleStatus: () => void;
  onUpdate: (patch: { price_estimate?: number | null; link?: string | null; notes?: string | null }) => void;
  onDelete: () => void;
}) {
  const [price, setPrice] = useState(item.price_estimate != null ? String(item.price_estimate) : "");
  const [link, setLink] = useState(item.link ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-card px-3 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCycleStatus}
          className="flex-shrink-0 text-xs"
          title="Cliquer pour changer le statut"
        >
          <Badge variant={item.status === "offert" ? "secondary" : "outline"}>{GIFT_STATUS_LABELS[item.status]}</Badge>
        </button>
        <span className={item.status === "offert" ? "flex-1 truncate text-sm text-muted-foreground line-through" : "flex-1 truncate text-sm"}>
          {item.title}
        </span>
        <Badge variant="outline" className="flex-shrink-0 font-normal">
          {GIFT_OCCASION_LABELS[item.occasion]}
        </Badge>
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => onUpdate({ price_estimate: price.trim() ? Number(price) : null })}
          placeholder="Prix estimé"
          className="h-8 w-28 flex-shrink-0 text-xs"
        />
        <Input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onBlur={() => onUpdate({ link: link.trim() || null })}
          placeholder="Lien (optionnel)"
          className="h-8 min-w-[8rem] flex-1 text-xs"
        />
        {item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => onUpdate({ notes: notes.trim() || null })}
        placeholder="Notes (taille, couleur, où l'acheter...)"
        className="min-h-[2rem] text-xs"
      />
    </div>
  );
}

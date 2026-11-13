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
import { GIFT_STATUS_LABELS, nextGiftStatus } from "@/features/gifts/gift-constants";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CollaboratorsPanel } from "@/features/projects/collaborators-panel";
import { EmojiPickerButton } from "@/features/shared/emoji-picker";
import { Breadcrumb } from "@/features/navigation/breadcrumb";
import { ProjectSwitcher } from "@/features/navigation/project-switcher";
import { PageHeroCard } from "@/features/shared/page-hero-card";
import { IconGlow } from "@/features/shared/icon-glow";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Trash2, Plus, ExternalLink } from "lucide-react";
import type { GiftItem, Person } from "@/types/database";

const NONE = "none";
const PEOPLE_DATALIST_ID = "gift-people-suggestions";

/** Résout un nom saisi librement vers une personne existante du répertoire (comparaison insensible
 * à la casse/espaces) si elle correspond exactement, sinon le garde comme nom libre (person_name) —
 * c'est ce qui permet de viser une idée de cadeau à quelqu'un sans l'ajouter au répertoire
 * "Personnes". Les deux champs restent mutuellement exclusifs. */
function resolvePersonInput(raw: string, people: Person[]): { person_id: string | null; person_name: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { person_id: null, person_name: null };
  const match = people.find((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
  return match ? { person_id: match.id, person_name: null } : { person_id: null, person_name: trimmed };
}

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
    <div className="max-w-4xl space-y-6">
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
  const [personInput, setPersonInput] = useState("");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createItem.mutateAsync({
      title: title.trim(),
      ...resolvePersonInput(personInput, people ?? []),
      link: null,
    });
    setTitle("");
  }

  const peopleById = useMemo(() => new Map((people ?? []).map((p) => [p.id, p])), [people]);

  const groups = useMemo(() => {
    type GroupEntry = { key: string; person: Person | null; label: string; isNone: boolean; items: GiftItem[] };
    const byKey = new Map<string, GroupEntry>();
    for (const item of items ?? []) {
      let key: string;
      let label: string;
      let person: Person | null = null;
      let isNone = false;
      if (item.person_id) {
        person = peopleById.get(item.person_id) ?? null;
        key = `id:${item.person_id}`;
        label = person?.name ?? "Personne supprimée";
      } else if (item.person_name) {
        key = `name:${item.person_name.trim().toLowerCase()}`;
        label = item.person_name;
      } else {
        key = NONE;
        label = "Sans destinataire";
        isNone = true;
      }
      const entry = byKey.get(key) ?? { key, person, label, isNone, items: [] };
      entry.items.push(item);
      byKey.set(key, entry);
    }
    const entries = [...byKey.values()];
    entries.sort((a, b) => {
      if (a.isNone) return 1;
      if (b.isNone) return -1;
      return a.label.localeCompare(b.label);
    });
    return entries;
  }, [items, peopleById]);

  if (isLoading) return <p className="py-6 text-sm text-muted-foreground">Chargement...</p>;

  return (
    <div className="space-y-4">
      {/* Partagée par le champ "Pour qui ?" ci-dessous ET l'édition inline de chaque carte (une
          seule datalist dans le DOM, référencée par son id, plutôt qu'une par champ). */}
      <datalist id={PEOPLE_DATALIST_ID}>
        {(people ?? []).map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>

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
            <Input
              list={PEOPLE_DATALIST_ID}
              placeholder="Pour qui ? (nom libre ou personne existante)"
              value={personInput}
              onChange={(e) => setPersonInput(e.target.value)}
              className="w-[260px]"
            />
          </div>
        </CardContent>
      </Card>

      {(items ?? []).length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Liste vide — ajoute ta première idée de cadeau.</p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.key} className="space-y-2">
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
                <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
              </div>
              {group.items.map((item) => (
                <GiftItemRow
                  key={item.id}
                  item={item}
                  people={people ?? []}
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
  people,
  onCycleStatus,
  onUpdate,
  onDelete,
}: {
  item: GiftItem;
  people: Person[];
  onCycleStatus: () => void;
  onUpdate: (patch: { title?: string; person_id?: string | null; person_name?: string | null; link?: string | null }) => void;
  onDelete: () => void;
}) {
  const linkedPerson = item.person_id ? people.find((p) => p.id === item.person_id) ?? null : null;
  const [title, setTitle] = useState(item.title);
  const [personText, setPersonText] = useState(linkedPerson?.name ?? item.person_name ?? "");
  const [link, setLink] = useState(item.link ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-1.5">
      <button type="button" onClick={onCycleStatus} className="flex-shrink-0 text-xs" title="Cliquer pour changer le statut">
        <Badge variant={item.status === "offert" ? "secondary" : "outline"}>{GIFT_STATUS_LABELS[item.status]}</Badge>
      </button>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          const trimmed = title.trim();
          if (trimmed) onUpdate({ title: trimmed });
          else setTitle(item.title);
        }}
        className={cn(
          "h-7 min-w-[8rem] flex-1 border-transparent bg-transparent px-1.5 text-sm shadow-none hover:border-border focus-visible:border-border",
          item.status === "offert" && "text-muted-foreground line-through"
        )}
      />
      <Input
        list={PEOPLE_DATALIST_ID}
        value={personText}
        onChange={(e) => setPersonText(e.target.value)}
        onBlur={() => onUpdate(resolvePersonInput(personText, people))}
        placeholder="Pour qui ?"
        className="h-7 w-28 flex-shrink-0 border-transparent bg-transparent px-1.5 text-xs text-muted-foreground shadow-none hover:border-border focus-visible:border-border sm:w-36"
      />
      <Input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        onBlur={() => onUpdate({ link: link.trim() || null })}
        placeholder="Lien"
        className="h-7 w-20 flex-shrink-0 border-transparent bg-transparent px-1.5 text-xs shadow-none hover:border-border focus-visible:border-border"
      />
      {item.link && (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          title="Ouvrir le lien"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useProject, useUpdateProject, useDeleteProject } from "@/features/projects/use-projects";
import { ProjectTitleInput } from "@/features/projects/project-title-input";
import { useThemeStore } from "@/features/theme/theme-store";
import { usePeople } from "@/features/people/use-people";
import { PersonAvatarBadge, AVATAR_COLOR_CLASSES } from "@/features/people/person-avatar";
import {
  useGiftItems,
  useCreateGiftItem,
  useUpdateGiftItem,
  useDeleteGiftItem,
  type GiftItemWithRecipients,
  type RecipientInput,
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
import { TagEditor } from "@/features/shared/tag-editor";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Trash2, Plus, ExternalLink } from "lucide-react";
import type { GiftItemRecipient, Person } from "@/types/database";

const NONE = "none";

/** Index stable (pas vraiment aléatoire mais toujours le même pour un même texte) dans une palette
 * cyclique — utilisé pour donner un avatar coloré cohérent à un destinataire texte libre, qui n'a
 * pas de `color_index` enregistré comme une personne du répertoire. */
function hashToIndex(value: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash % mod;
}

/** Résout une liste de noms saisis (tags) vers des destinataires : une personne existante du
 * répertoire (comparaison insensible à la casse/espaces) si elle correspond exactement, sinon un
 * nom libre — ce qui permet de viser un cadeau à quelqu'un sans l'ajouter au répertoire
 * "Personnes", y compris pour un cadeau commun à plusieurs destinataires. */
function resolveRecipientInputs(names: string[], people: Person[]): RecipientInput[] {
  return names.map((raw) => {
    const trimmed = raw.trim();
    const match = people.find((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
    return match ? { person_id: match.id, name: null } : { person_id: null, name: trimmed };
  });
}

type RecipientEntry = {
  key: string;
  label: string;
  personId?: string;
  avatarEmoji?: string | null;
  avatarConfig?: Person["avatar_config"];
  colorIndex: number;
};

/** Donne à chaque destinataire d'un cadeau son identité d'affichage (nom, avatar) — une personne
 * liée reprend son avatar réel, un nom libre reçoit une couleur stable dérivée de son texte (voir
 * hashToIndex) de manière à ne pas scintiller d'un rendu à l'autre. */
function recipientEntry(r: GiftItemRecipient, peopleById: Map<string, Person>): RecipientEntry {
  if (r.person_id) {
    const person = peopleById.get(r.person_id);
    if (person) {
      return {
        key: `p:${person.id}`,
        label: person.name,
        personId: person.id,
        avatarEmoji: person.avatar_emoji,
        avatarConfig: person.avatar_config,
        colorIndex: person.color_index ?? hashToIndex(person.id, AVATAR_COLOR_CLASSES.length),
      };
    }
    return { key: `p:${r.person_id}`, label: "Personne supprimée", colorIndex: hashToIndex(r.person_id, AVATAR_COLOR_CLASSES.length) };
  }
  const name = (r.name ?? "").trim();
  return { key: `n:${name.toLowerCase()}`, label: name, colorIndex: hashToIndex(name.toLowerCase(), AVATAR_COLOR_CLASSES.length) };
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
  const [recipientNames, setRecipientNames] = useState<string[]>([]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createItem.mutateAsync({
      title: title.trim(),
      recipients: resolveRecipientInputs(recipientNames, people ?? []),
      link: null,
    });
    setTitle("");
    setRecipientNames([]);
  }

  const peopleById = useMemo(() => new Map((people ?? []).map((p) => [p.id, p])), [people]);
  const peopleNames = useMemo(() => (people ?? []).map((p) => p.name), [people]);

  // Regroupe par l'ENSEMBLE des destinataires d'un cadeau (pas un seul nom) : un cadeau commun à
  // "Papa + Maman" forme son propre groupe, distinct des cadeaux solo pour "Papa" ou pour "Maman".
  // La clé de chaque destinataire est stable (id de personne, ou nom normalisé en texte libre) pour
  // qu'une même personne visée via le répertoire ou en texte libre fusionne dans le même groupe.
  const groups = useMemo(() => {
    type GroupEntry = { key: string; label: string; recipients: RecipientEntry[]; isNone: boolean; items: GiftItemWithRecipients[] };
    const byKey = new Map<string, GroupEntry>();
    for (const item of items ?? []) {
      const entries = item.recipients.map((r) => recipientEntry(r, peopleById));
      const sorted = [...entries].sort((a, b) => a.label.localeCompare(b.label));
      const isNone = sorted.length === 0;
      const key = isNone ? NONE : sorted.map((e) => e.key).join("|");
      const label = isNone ? "Sans destinataire" : sorted.map((e) => e.label).join(", ");
      const entry = byKey.get(key);
      if (entry) entry.items.push(item);
      else byKey.set(key, { key, label, recipients: sorted, isNone, items: [item] });
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
          <div>
            <p className="text-xs text-muted-foreground">
              Pour qui ? (nom libre ou personne existante — plusieurs pour un cadeau commun)
            </p>
            <TagEditor
              tags={recipientNames}
              suggestions={peopleNames}
              addLabel="Destinataire"
              placeholder="Nom"
              onChange={setRecipientNames}
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
                {group.recipients.length > 0 && (
                  <div className="flex -space-x-1.5">
                    {group.recipients.map((r) => (
                      <PersonAvatarBadge
                        key={r.key}
                        name={r.label}
                        avatarEmoji={r.avatarEmoji}
                        avatarConfig={r.avatarConfig}
                        personId={r.personId}
                        colorIndex={r.colorIndex}
                        index={0}
                        className="h-6 w-6 border-2 border-background text-xs"
                      />
                    ))}
                  </div>
                )}
                <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
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
  item: GiftItemWithRecipients;
  onCycleStatus: () => void;
  onUpdate: (patch: { title?: string; link?: string | null }) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(item.title);
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
          "h-7 min-w-[5rem] flex-1 border-transparent bg-transparent px-1.5 text-sm shadow-none hover:border-border focus-visible:border-border",
          item.status === "offert" && "text-muted-foreground line-through"
        )}
      />
      {/* Groupés ensemble (pas des enfants flex séparés du conteneur principal) pour que le bouton
          de suppression ne se retrouve jamais seul sur sa propre ligne quand ça wrappe — il wrappe
          alors avec le champ lien, jamais isolé. */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <Input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onBlur={() => onUpdate({ link: link.trim() || null })}
          placeholder="Lien"
          className="h-7 w-20 border-transparent bg-transparent px-1.5 text-xs shadow-none hover:border-border focus-visible:border-border"
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
    </div>
  );
}

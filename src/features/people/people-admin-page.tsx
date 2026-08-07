import { useState } from "react";
import { usePeople, useCreatePerson, useDeletePerson } from "@/features/people/use-people";
import { PersonAvatarBadge, PERSON_EMOJI_SUGGESTIONS } from "@/features/people/person-avatar";
import { AvatarPickerDialog } from "@/features/people/avatar-picker-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus } from "lucide-react";
import type { Person } from "@/types/database";

/** Gestion de la liste globale de personnes (nom + avatar), réutilisable sur tous les projets
 * du portefeuille (voyages ou autres) — accessible depuis Réglages. */
export function PeopleAdminPage() {
  const { data: people, isLoading } = usePeople();
  const createPerson = useCreatePerson();
  const deletePerson = useDeletePerson();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  async function handleAdd() {
    if (!name.trim()) return;
    await createPerson.mutateAsync({ name: name.trim(), avatar_emoji: emoji || null, order_index: people?.length ?? 0 });
    setName("");
    setEmoji("");
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Personnes</h1>
        <p className="text-sm text-muted-foreground">
          Une liste de personnes réutilisable sur tous tes projets (ex. les voyageurs d'un voyage).
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <select
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              title="Avatar (optionnel)"
            >
              <option value="">🙂</option>
              {PERSON_EMOJI_SUGGESTIONS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <Input
              placeholder="Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
            />
            <Button type="button" onClick={handleAdd} disabled={!name.trim()}>
              <Plus className="mr-2 h-4 w-4" /> Ajouter
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            L'avatar personnalisé (couleur de peau, coiffure, accessoire) se règle après création, en cliquant sur l'avatar
            d'une personne dans la liste ci-dessous.
          </p>

          {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}
          <ul className="divide-y divide-border">
            {(people ?? []).map((p, i) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPerson(p)}
                    className="rounded-full transition hover:ring-2 hover:ring-accent/40"
                    title="Personnaliser l'avatar"
                  >
                    <PersonAvatarBadge name={p.name} avatarEmoji={p.avatar_emoji} avatarConfig={p.avatar_config} personId={p.id} index={i} />
                  </button>
                  <span className="text-sm">{p.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (window.confirm(`Retirer "${p.name}" de la liste des personnes ? Elle sera aussi retirée de tous les projets.`)) {
                      deletePerson.mutate(p.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {(people ?? []).length === 0 && !isLoading && (
              <p className="py-2 text-sm text-muted-foreground">Aucune personne pour l'instant.</p>
            )}
          </ul>
        </CardContent>
      </Card>

      {editingPerson && (
        <AvatarPickerDialog
          person={editingPerson}
          open={!!editingPerson}
          onOpenChange={(open) => !open && setEditingPerson(null)}
        />
      )}
    </div>
  );
}

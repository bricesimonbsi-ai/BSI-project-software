import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTravelers, useCreateTraveler, useDeleteTraveler } from "@/features/voyages/use-travelers";
import { TravelerAvatarBadge, TRAVELER_EMOJI_SUGGESTIONS } from "@/features/voyages/traveler-avatar";
import { Plus, Trash2 } from "lucide-react";

/** Liste des voyageurs nommés du voyage (nom + avatar), avec ajout/suppression en ligne. */
export function TravelersPanel({ voyageId }: { voyageId: string }) {
  const { data: travelers } = useTravelers(voyageId);
  const createTraveler = useCreateTraveler(voyageId);
  const deleteTraveler = useDeleteTraveler(voyageId);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");

  async function handleAdd() {
    if (!newName.trim()) return;
    await createTraveler.mutateAsync({
      name: newName.trim(),
      avatar_emoji: newEmoji || null,
      order_index: travelers?.length ?? 0,
    });
    setNewName("");
    setNewEmoji("");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {(travelers ?? []).map((t, i) => (
          <div key={t.id} className="group flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3">
            <TravelerAvatarBadge name={t.name} avatarEmoji={t.avatar_emoji} index={i} />
            <span className="text-sm">{t.name}</span>
            <button
              type="button"
              onClick={() => deleteTraveler.mutate(t.id)}
              className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-60 hover:opacity-100"
              title="Retirer ce voyageur"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        {(travelers ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucun voyageur nommé pour l'instant.</p>}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={newEmoji}
          onChange={(e) => setNewEmoji(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          title="Avatar (optionnel)"
        >
          <option value="">🙂</option>
          {TRAVELER_EMOJI_SUGGESTIONS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <Input
          placeholder="Nom du voyageur"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          className="max-w-xs"
        />
        <Button type="button" size="sm" variant="outline" onClick={handleAdd} disabled={!newName.trim()}>
          <Plus className="mr-1.5 h-4 w-4" /> Ajouter
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Utilisé pour répartir le budget par personne et, si tu le souhaites, rattacher une dépense à quelqu'un en particulier.
      </p>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  usePeople,
  useCreatePerson,
  useProjectPeople,
  useAddPersonToProject,
  useRemovePersonFromProject,
  useUpdateProjectPersonBudgetTarget,
} from "@/features/people/use-people";
import { PersonAvatarBadge, PERSON_EMOJI_SUGGESTIONS } from "@/features/people/person-avatar";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";

/** Champ compact pour le budget cible d'un voyageur — obligatoire (signalé visuellement tant
 * qu'il n'est pas renseigné) : sert à calculer son propre % de consommation dans l'onglet
 * Budget, distinct du % de chaque autre voyageur. */
function BudgetTargetInput({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const [text, setText] = useState(value?.toString() ?? "");
  useEffect(() => {
    setText(value?.toString() ?? "");
  }, [value]);
  return (
    <Input
      type="number"
      min="0"
      step="0.01"
      placeholder="Obligatoire"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const v = text.trim() === "" ? null : Math.max(0, Number(text));
        if (v !== value) onCommit(v);
      }}
      className={cn("h-8 w-32 text-sm", value == null && "border-destructive/60 placeholder:text-destructive/70")}
    />
  );
}

/**
 * Associe des personnes de la liste globale (paramétrable dans Réglages → Personnes) à ce
 * projet — remplace un panneau "voyageurs" propre à un seul voyage : la même personne se
 * réutilise sur plusieurs projets.
 */
export function ProjectPeoplePicker({ projectId }: { projectId: string }) {
  const { data: allPeople } = usePeople();
  const { data: linked } = useProjectPeople(projectId);
  const createPerson = useCreatePerson();
  const addToProject = useAddPersonToProject(projectId);
  const removeFromProject = useRemovePersonFromProject(projectId);
  const updateBudgetTarget = useUpdateProjectPersonBudgetTarget(projectId);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");

  const linkedPersonIds = new Set((linked ?? []).map((l) => l.person_id));
  const availablePeople = (allPeople ?? []).filter((p) => !linkedPersonIds.has(p.id));

  async function handleAddExisting() {
    if (!selectedPersonId) return;
    await addToProject.mutateAsync(selectedPersonId);
    setSelectedPersonId("");
  }

  async function handleCreateAndAdd() {
    if (!newName.trim()) return;
    const person = await createPerson.mutateAsync({
      name: newName.trim(),
      avatar_emoji: newEmoji || null,
      order_index: allPeople?.length ?? 0,
    });
    await addToProject.mutateAsync(person.id);
    setNewName("");
    setNewEmoji("");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {(linked ?? []).map((l, i) => (
          <div key={l.id} className="group flex items-center gap-2 rounded-md border border-border py-1.5 pl-1.5 pr-2">
            <PersonAvatarBadge
              name={l.people.name}
              avatarEmoji={l.people.avatar_emoji}
              avatarConfig={l.people.avatar_config}
              personId={l.people.id}
              index={i}
            />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{l.people.name}</span>
                <button
                  type="button"
                  onClick={() => removeFromProject.mutate(l.id)}
                  className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-60 hover:opacity-100"
                  title="Retirer de ce projet"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-[0.7rem] font-normal text-muted-foreground">Budget cible</Label>
                <BudgetTargetInput value={l.budget_target} onCommit={(v) => updateBudgetTarget.mutate({ id: l.id, budget_target: v })} />
              </div>
            </div>
          </div>
        ))}
        {(linked ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucune personne associée pour l'instant.</p>}
      </div>

      {availablePeople.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Choisir une personne existante" />
            </SelectTrigger>
            <SelectContent>
              {availablePeople.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.avatar_emoji ? `${p.avatar_emoji} ` : ""}
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" onClick={handleAddExisting} disabled={!selectedPersonId}>
            <Plus className="mr-1.5 h-4 w-4" /> Associer
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <select
          value={newEmoji}
          onChange={(e) => setNewEmoji(e.target.value)}
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
          placeholder="Nouvelle personne"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleCreateAndAdd())}
          className="max-w-xs"
        />
        <Button type="button" size="sm" variant="outline" onClick={handleCreateAndAdd} disabled={!newName.trim()}>
          <Plus className="mr-1.5 h-4 w-4" /> Créer et associer
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Liste réutilisable sur tous tes projets, gérée dans Réglages → Personnes. Le budget cible de chaque voyageur
        (obligatoire, propre à ce voyage) sert à calculer son % de consommation individuel dans l'onglet Budget.
      </p>
    </div>
  );
}

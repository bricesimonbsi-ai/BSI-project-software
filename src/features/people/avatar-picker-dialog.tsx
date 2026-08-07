import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useUpdatePerson } from "@/features/people/use-people";
import { PERSON_EMOJI_SUGGESTIONS } from "@/features/people/person-avatar";
import {
  AVATAR_SKIN_COLORS,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIRSTYLES,
  AVATAR_ACCESSORIES,
  DEFAULT_AVATAR_CONFIG,
  generateAvatarDataUri,
} from "@/features/people/avatar-generator";
import { cn } from "@/lib/utils";
import type { Person, PersonAvatarConfig } from "@/types/database";

const NO_ACCESSORY = "none";

function ColorSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`#${color}`}
      className={cn(
        "h-7 w-7 flex-shrink-0 rounded-full border-2 transition",
        selected ? "border-accent ring-2 ring-accent/40" : "border-border/60 hover:border-border"
      )}
      style={{ backgroundColor: `#${color}` }}
    />
  );
}

/** Personnalisation d'avatar : émoji rapide, ou avatar généré (DiceBear) avec choix de la
 * couleur de peau, de la coiffure, de la couleur de cheveux et d'un accessoire — tout est rendu
 * localement (aucun appel réseau). */
export function AvatarPickerDialog({
  person,
  open,
  onOpenChange,
}: {
  person: Person;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updatePerson = useUpdatePerson();
  const [emoji, setEmoji] = useState(person.avatar_emoji ?? "");
  const [config, setConfig] = useState<PersonAvatarConfig>(person.avatar_config ?? DEFAULT_AVATAR_CONFIG);
  const [mode, setMode] = useState<"emoji" | "custom">(person.avatar_config ? "custom" : "emoji");

  useEffect(() => {
    if (!open) return;
    setEmoji(person.avatar_emoji ?? "");
    setConfig(person.avatar_config ?? DEFAULT_AVATAR_CONFIG);
    setMode(person.avatar_config ? "custom" : "emoji");
  }, [open, person]);

  const previewUri = generateAvatarDataUri(person.id, config);

  async function handleSave() {
    if (mode === "emoji") {
      await updatePerson.mutateAsync({ id: person.id, avatar_emoji: emoji || null, avatar_config: null });
    } else {
      await updatePerson.mutateAsync({ id: person.id, avatar_config: config });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Avatar de {person.name}</DialogTitle>
          <DialogDescription>Choisis un émoji rapide ou personnalise un avatar généré.</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "emoji" | "custom")}>
          <TabsList>
            <TabsTrigger value="emoji">Émoji</TabsTrigger>
            <TabsTrigger value="custom">Avatar personnalisé</TabsTrigger>
          </TabsList>

          <TabsContent value="emoji" className="mt-3 space-y-2">
            <Label>Émoji</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEmoji("")}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md border text-lg",
                  emoji === "" ? "border-accent ring-2 ring-accent/40" : "border-border/60 hover:border-border"
                )}
                title="Aucun (initiale du nom)"
              >
                {person.name.trim().charAt(0).toUpperCase() || "?"}
              </button>
              {PERSON_EMOJI_SUGGESTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md border text-lg",
                    emoji === e ? "border-accent ring-2 ring-accent/40" : "border-border/60 hover:border-border"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="mt-3 space-y-4">
            <div className="flex justify-center">
              <img src={previewUri} alt="Aperçu de l'avatar" className="h-24 w-24 rounded-full bg-muted" />
            </div>

            <div className="space-y-2">
              <Label>Couleur de peau</Label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_SKIN_COLORS.map((c) => (
                  <ColorSwatch key={c} color={c} selected={config.skinColor === c} onClick={() => setConfig({ ...config, skinColor: c })} />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Coiffure</Label>
              <Select value={config.top} onValueChange={(v) => setConfig({ ...config, top: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVATAR_HAIRSTYLES.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Couleur de cheveux</Label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_HAIR_COLORS.map((c) => (
                  <ColorSwatch key={c} color={c} selected={config.hairColor === c} onClick={() => setConfig({ ...config, hairColor: c })} />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Accessoire</Label>
              <Select
                value={config.accessories ?? NO_ACCESSORY}
                onValueChange={(v) => setConfig({ ...config, accessories: v === NO_ACCESSORY ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACCESSORY}>Aucun</SelectItem>
                  {AVATAR_ACCESSORIES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={updatePerson.isPending}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

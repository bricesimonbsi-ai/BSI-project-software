import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

/**
 * Badges retirables + ajout libre ou depuis une liste de suggestions — utilisé pour le classement
 * par style des lieux (Bars & Restaurants) et par genre des films/séries (Médias). Générique :
 * `tags`/`onChange` portent le tableau de chaînes à éditer, `suggestions` propose des valeurs
 * courantes non déjà présentes.
 */
export function TagEditor({
  tags,
  suggestions,
  addLabel = "Ajouter",
  placeholder = "...",
  onChange,
}: {
  tags: string[];
  suggestions: string[];
  addLabel?: string;
  placeholder?: string;
  onChange: (tags: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) {
      setAdding(false);
      setValue("");
      return;
    }
    onChange([...tags, trimmed]);
    setValue("");
    setAdding(false);
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  const remainingSuggestions = suggestions.filter((s) => !tags.includes(s));

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex flex-wrap items-center gap-1">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" className="flex items-center gap-1 text-[0.65rem]">
            {t}
            <button type="button" onClick={() => removeTag(t)} className="hover:text-destructive">
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        {adding ? (
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTag(value);
              if (e.key === "Escape") {
                setAdding(false);
                setValue("");
              }
            }}
            onBlur={() => (value.trim() ? addTag(value) : setAdding(false))}
            placeholder={placeholder}
            className="h-6 w-28 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-0.5 rounded-full border border-dashed border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground hover:border-accent hover:text-accent"
          >
            <Plus className="h-2.5 w-2.5" /> {addLabel}
          </button>
        )}
      </div>
      {remainingSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {remainingSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground hover:border-accent hover:text-accent"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EMOJI_CATEGORIES, searchEmojis } from "@/features/shared/emoji-library";
import { cn } from "@/lib/utils";
import { Smile } from "lucide-react";

function EmojiGrid({ emojis, onSelect }: { emojis: { char: string }[]; onSelect: (emoji: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1">
      {emojis.map((e) => (
        <button
          key={e.char}
          type="button"
          onClick={() => onSelect(e.char)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-xl transition hover:bg-secondary"
        >
          {e.char}
        </button>
      ))}
    </div>
  );
}

function EmojiPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (emoji: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const searchResults = useMemo(() => searchEmojis(query), [query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choisir une icône</DialogTitle>
          <DialogDescription>Recherche par mot-clé ou parcours les catégories.</DialogDescription>
        </DialogHeader>

        <Input placeholder="Rechercher (ex. plage, avion, argent...)" value={query} onChange={(e) => setQuery(e.target.value)} />

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
            Aucune icône
          </Button>
        </div>

        {query.trim() ? (
          <div className="max-h-72 overflow-y-auto">
            {searchResults.length > 0 ? (
              <EmojiGrid emojis={searchResults} onSelect={onSelect} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucun résultat pour "{query}".</p>
            )}
          </div>
        ) : (
          <Tabs defaultValue={EMOJI_CATEGORIES[0].id}>
            <TabsList className="h-auto flex-wrap justify-start overflow-x-visible">
              {EMOJI_CATEGORIES.map((c) => (
                <TabsTrigger key={c.id} value={c.id} className="text-xs">
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {EMOJI_CATEGORIES.map((c) => (
              <TabsContent key={c.id} value={c.id} className="max-h-64 overflow-y-auto">
                <EmojiGrid emojis={c.emojis} onSelect={onSelect} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Bouton compact affichant l'icône choisie (ou un pictogramme neutre), ouvrant le picker au
 * clic. Utilisable partout où une catégorie ou un projet peut être personnalisé. */
export function EmojiPickerButton({
  value,
  onChange,
  className,
}: {
  value?: string | null;
  onChange: (emoji: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Choisir une icône"
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-border/60 text-lg transition hover:border-border",
          className
        )}
      >
        {value ?? <Smile className="h-4 w-4 text-muted-foreground" />}
      </button>
      <EmojiPickerDialog
        open={open}
        onOpenChange={setOpen}
        onSelect={(emoji) => {
          onChange(emoji);
          setOpen(false);
        }}
      />
    </>
  );
}

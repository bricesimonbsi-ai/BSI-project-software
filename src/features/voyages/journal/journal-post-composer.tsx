import { useRef, useState } from "react";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import { useCreateJournalPost } from "@/features/voyages/journal/use-journal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ImagePlus, X } from "lucide-react";

const NO_CITY = "__none__";

/** Composeur de post du journal : photos (montage automatique à l'affichage, voir PhotoCollage)
 * + texte libre + ville optionnelle de l'itinéraire + date du souvenir (par défaut aujourd'hui,
 * modifiable pour publier après-coup un moment déjà passé). */
export function JournalPostComposer({ voyageId }: { voyageId: string }) {
  const { data: sousEtapes } = useVoyageSousEtapes(voyageId);
  const createPost = useCreateJournalPost(voyageId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sousEtapeId, setSousEtapeId] = useState(NO_CITY);

  function handleFilesSelected(newFiles: FileList | null) {
    if (!newFiles) return;
    const added = Array.from(newFiles);
    setFiles((prev) => [...prev, ...added]);
    setPreviews((prev) => [...prev, ...added.map((f) => URL.createObjectURL(f))]);
  }

  function removeFile(index: number) {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function reset() {
    previews.forEach((p) => URL.revokeObjectURL(p));
    setFiles([]);
    setPreviews([]);
    setCaption("");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setSousEtapeId(NO_CITY);
  }

  async function handlePublish() {
    if (files.length === 0 && !caption.trim()) return;
    await createPost.mutateAsync({
      caption: caption.trim(),
      entryDate,
      sousEtapeId: sousEtapeId === NO_CITY ? null : sousEtapeId,
      files,
    });
    reset();
  }

  const canPublish = (files.length > 0 || caption.trim().length > 0) && !createPost.isPending;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Textarea
          placeholder="Qu'avez-vous fait, vu, vécu ?"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
        />

        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {previews.map((src, i) => (
              <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-md">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFilesSelected(e.target.files);
              e.target.value = "";
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus className="mr-1.5 h-4 w-4" /> Ajouter des photos
          </Button>

          <Select value={sousEtapeId} onValueChange={setSousEtapeId}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CITY}>Aucune ville</SelectItem>
              {(sousEtapes ?? []).map((se) => (
                <SelectItem key={se.id} value={se.id}>
                  {se.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-40" />

          <Button type="button" size="sm" className="ml-auto" onClick={handlePublish} disabled={!canPublish}>
            {createPost.isPending ? "Publication..." : "Publier"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

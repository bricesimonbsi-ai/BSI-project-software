import { useEffect, useRef, useState } from "react";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import {
  useCreateJournalPost,
  useUpdateJournalPost,
  journalPhotoUrl,
  type JournalPostWithPhotos,
} from "@/features/voyages/journal/use-journal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ImagePlus, X } from "lucide-react";
import type { VoyageJournalPhoto } from "@/types/database";

const NO_COUNTRY = "__none__";
const NO_CITY = "__none__";

/** Composeur de post du journal : photos (montage automatique à l'affichage, voir PhotoCollage)
 * + texte libre + pays puis ville optionnels de l'itinéraire (la ville est filtrée par le pays
 * choisi) + date du souvenir. Sert aussi de formulaire d'édition : passer `editingPost` préremplit
 * les champs et fait basculer le bouton "Publier" en "Enregistrer les modifications". */
export function JournalPostComposer({
  voyageId,
  editingPost,
  onDone,
}: {
  voyageId: string;
  editingPost?: JournalPostWithPhotos | null;
  onDone?: () => void;
}) {
  const { data: etapes } = useEtapes(voyageId);
  const { data: sousEtapes } = useVoyageSousEtapes(voyageId);
  const createPost = useCreateJournalPost(voyageId);
  const updatePost = useUpdateJournalPost(voyageId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<VoyageJournalPhoto[]>([]);
  const [removedPhotos, setRemovedPhotos] = useState<VoyageJournalPhoto[]>([]);
  const [caption, setCaption] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [etapeId, setEtapeId] = useState(NO_COUNTRY);
  const [sousEtapeId, setSousEtapeId] = useState(NO_CITY);

  const isEditing = !!editingPost;

  useEffect(() => {
    if (!editingPost) {
      reset();
      return;
    }
    setCaption(editingPost.caption ?? "");
    setEntryDate(editingPost.entry_date);
    setExistingPhotos(editingPost.voyage_journal_photos);
    setRemovedPhotos([]);
    setFiles([]);
    setPreviews([]);
    if (editingPost.sous_etape_id) {
      const se = (sousEtapes ?? []).find((s) => s.id === editingPost.sous_etape_id);
      setSousEtapeId(editingPost.sous_etape_id);
      setEtapeId(se?.etape_id ?? NO_COUNTRY);
    } else {
      setEtapeId(NO_COUNTRY);
      setSousEtapeId(NO_CITY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPost, sousEtapes]);

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

  function removeExistingPhoto(photo: VoyageJournalPhoto) {
    setExistingPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setRemovedPhotos((prev) => [...prev, photo]);
  }

  function reset() {
    previews.forEach((p) => URL.revokeObjectURL(p));
    setFiles([]);
    setPreviews([]);
    setExistingPhotos([]);
    setRemovedPhotos([]);
    setCaption("");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setEtapeId(NO_COUNTRY);
    setSousEtapeId(NO_CITY);
  }

  async function handlePublish() {
    if (files.length === 0 && existingPhotos.length === 0 && !caption.trim()) return;
    const resolvedSousEtapeId = sousEtapeId === NO_CITY ? null : sousEtapeId;

    if (isEditing && editingPost) {
      await updatePost.mutateAsync({
        id: editingPost.id,
        caption: caption.trim(),
        entryDate,
        sousEtapeId: resolvedSousEtapeId,
        newFiles: files,
        removedPhotos,
        keptPhotoCount: existingPhotos.length,
      });
      onDone?.();
    } else {
      await createPost.mutateAsync({
        caption: caption.trim(),
        entryDate,
        sousEtapeId: resolvedSousEtapeId,
        files,
      });
    }
    reset();
  }

  const submitting = createPost.isPending || updatePost.isPending;
  const canPublish = (files.length > 0 || existingPhotos.length > 0 || caption.trim().length > 0) && !submitting;
  const citiesForCountry = (sousEtapes ?? []).filter((se) => se.etape_id === etapeId);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Textarea
          placeholder="Qu'avez-vous fait, vu, vécu ?"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
        />

        {(existingPhotos.length > 0 || previews.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {existingPhotos.map((photo) => (
              <div key={photo.id} className="group relative h-20 w-20 overflow-hidden rounded-md">
                <img src={journalPhotoUrl(photo.storage_path)} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeExistingPhoto(photo)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
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

          <Select
            value={etapeId}
            onValueChange={(v) => {
              setEtapeId(v);
              setSousEtapeId(NO_CITY);
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Pays" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_COUNTRY}>Aucun pays</SelectItem>
              {(etapes ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.country_region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sousEtapeId} onValueChange={setSousEtapeId} disabled={etapeId === NO_COUNTRY}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Ville" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CITY}>Aucune ville</SelectItem>
              {citiesForCountry.map((se) => (
                <SelectItem key={se.id} value={se.id}>
                  {se.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-40" />

          <div className="ml-auto flex items-center gap-2">
            {isEditing && (
              <Button type="button" size="sm" variant="ghost" onClick={onDone}>
                Annuler
              </Button>
            )}
            <Button type="button" size="sm" onClick={handlePublish} disabled={!canPublish}>
              {submitting ? "Enregistrement..." : isEditing ? "Enregistrer les modifications" : "Publier"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

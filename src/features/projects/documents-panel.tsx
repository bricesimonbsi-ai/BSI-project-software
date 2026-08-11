import { useRef, useState } from "react";
import { useDocuments, useUploadDocument, useDeleteDocument, useRenameDocument, getDocumentUrl } from "@/features/projects/use-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { FileText, Trash2, Upload, Pencil, Check, ExternalLink } from "lucide-react";
import type { DocumentRow } from "@/types/database";

export function DocumentsPanel({ projectId, voyageEtapeId }: { projectId: string; voyageEtapeId?: string }) {
  const { data: documents, isLoading } = useDocuments(projectId, voyageEtapeId);
  const uploadDocument = useUploadDocument(projectId, voyageEtapeId);
  const deleteDocument = useDeleteDocument(projectId);
  const renameDocument = useRenameDocument(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [preview, setPreview] = useState<{ doc: DocumentRow; url: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument.mutateAsync(file);
    } catch (err) {
      toast({ title: "Échec de l'upload", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleOpen(doc: DocumentRow) {
    setLoadingPreview(doc.id);
    try {
      const url = await getDocumentUrl(doc.storage_path);
      setPreview({ doc, url });
    } catch (err) {
      toast({ title: "Impossible d'ouvrir le document", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoadingPreview(null);
    }
  }

  function startRename(doc: DocumentRow) {
    setEditingId(doc.id);
    setEditingName(doc.name);
  }

  async function commitRename() {
    if (!editingId || !editingName.trim()) {
      setEditingId(null);
      return;
    }
    await renameDocument.mutateAsync({ id: editingId, name: editingName.trim() });
    setEditingId(null);
  }

  const isImage = preview?.doc.mime_type?.startsWith("image/");
  const isPdf = preview?.doc.mime_type === "application/pdf";

  return (
    <div className="space-y-4">
      <div>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          <Upload className="mr-2 h-4 w-4" /> {uploading ? "Envoi..." : "Ajouter un document"}
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement...</p>}

      <ul className="space-y-2">
        {(documents ?? []).map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
            {editingId === doc.id ? (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && commitRename()}
                  autoFocus
                  className="h-8"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={commitRename}>
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => handleOpen(doc)}
                disabled={loadingPreview === doc.id}
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm hover:underline disabled:opacity-60"
              >
                <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="truncate">{doc.name}</span>
              </button>
            )}
            <div className="flex flex-shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => startRename(doc)} title="Renommer">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteDocument.mutate(doc)} title="Supprimer">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
        {!isLoading && (documents ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun document pour l'instant.</p>
        )}
      </ul>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{preview?.doc.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-3">
              {isImage && <img src={preview.url} alt={preview.doc.name} className="max-h-[70vh] w-full rounded-md object-contain" />}
              {isPdf && <iframe src={preview.url} title={preview.doc.name} className="h-[70vh] w-full rounded-md border border-border" />}
              {!isImage && !isPdf && (
                <p className="py-8 text-center text-sm text-muted-foreground">Aperçu non disponible pour ce type de fichier.</p>
              )}
              <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Ouvrir dans un nouvel onglet
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

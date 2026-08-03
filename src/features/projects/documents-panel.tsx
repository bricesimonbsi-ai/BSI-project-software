import { useRef, useState } from "react";
import { useDocuments, useUploadDocument, useDeleteDocument, getDocumentUrl } from "@/features/projects/use-documents";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { FileText, Trash2, Upload } from "lucide-react";

export function DocumentsPanel({ projectId, voyageEtapeId }: { projectId: string; voyageEtapeId?: string }) {
  const { data: documents, isLoading } = useDocuments(projectId, voyageEtapeId);
  const uploadDocument = useUploadDocument(projectId, voyageEtapeId);
  const deleteDocument = useDeleteDocument(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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

  async function handleOpen(path: string) {
    try {
      const url = await getDocumentUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast({ title: "Impossible d'ouvrir le document", description: (err as Error).message, variant: "destructive" });
    }
  }

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
          <li key={doc.id} className="flex items-center justify-between rounded-md border border-border p-3">
            <button onClick={() => handleOpen(doc.storage_path)} className="flex items-center gap-2 text-sm hover:underline">
              <FileText className="h-4 w-4 text-muted-foreground" /> {doc.name}
            </button>
            <Button variant="ghost" size="icon" onClick={() => deleteDocument.mutate(doc)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
        {!isLoading && (documents ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun document pour l'instant.</p>
        )}
      </ul>
    </div>
  );
}

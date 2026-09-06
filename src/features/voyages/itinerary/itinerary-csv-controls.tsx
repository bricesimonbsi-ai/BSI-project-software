import { useRef, useState } from "react";
import { Download, Upload, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { buildItineraryCsv, parseItineraryCsv, type ImportResult } from "@/features/voyages/itinerary/itinerary-csv";
import { useImportItinerary } from "@/features/voyages/itinerary/use-itinerary-import";
import type { FlatRow } from "@/features/voyages/itinerary/itinerary-model";

export function ItineraryExportButton({ flat }: { flat: FlatRow[] }) {
  function handleExport() {
    const csv = buildItineraryCsv(flat);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `itineraire-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={flat.length === 0}>
      <Download className="mr-1.5 h-4 w-4" /> Exporter
    </Button>
  );
}

/**
 * L'import REMPLACE tout l'itinéraire existant (pas de fusion — cf. use-itinerary-import.ts) :
 * un aperçu + une confirmation explicite avant d'écraser quoi que ce soit, conformément à toute
 * action destructive de l'application.
 */
export function ItineraryImportButton({ voyageId }: { voyageId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const importItinerary = useImportItinerary(voyageId);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const text = await file.text();
    const result = parseItineraryCsv(text);
    if (result.countries.length === 0) {
      toast({ title: "Import impossible", description: result.errors[0] ?? "Fichier illisible.", variant: "destructive" });
      return;
    }
    setPreview(result);
  }

  function handleConfirm() {
    if (!preview) return;
    importItinerary.mutate(
      { countries: preview.countries, anchorStartDate: preview.anchorStartDate },
      { onSuccess: () => setPreview(null) }
    );
  }

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
        <Upload className="mr-1.5 h-4 w-4" /> Importer
      </Button>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Remplacer l'itinéraire par ce fichier ?</DialogTitle>
            <DialogDescription>
              {preview?.countries.length} pays, {preview?.totalCities} ville{preview && preview.totalCities > 1 ? "s" : ""} trouvés.
              Cette action remplace intégralement l'itinéraire actuel du voyage — impossible à annuler.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2 text-sm">
            {preview?.countries.map((c) => (
              <div key={c.country_region} className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.country_region}</span>
                <span className="text-xs text-muted-foreground">
                  {c.cities.length} ville{c.cities.length > 1 ? "s" : ""} : {c.cities.map((ci) => ci.city).join(", ")}
                </span>
              </div>
            ))}
          </div>

          {preview && preview.errors.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <div className="space-y-0.5">
                {preview.errors.slice(0, 5).map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)} disabled={importItinerary.isPending}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={importItinerary.isPending}>
              {importItinerary.isPending ? "Import..." : "Remplacer l'itinéraire"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

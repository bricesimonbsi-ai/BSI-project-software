import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateEtape, useUpdateEtape } from "@/features/voyages/use-etapes";
import type { VoyageEtape } from "@/types/database";
import { Plus, Pencil } from "lucide-react";

export function EtapeDialog({ voyageId, nextOrder, existing }: { voyageId: string; nextOrder: number; existing?: VoyageEtape }) {
  const [open, setOpen] = useState(false);
  const [countryRegion, setCountryRegion] = useState(existing?.country_region ?? "");
  const [arrivalDate, setArrivalDate] = useState(existing?.arrival_date ?? "");
  const [durationDays, setDurationDays] = useState(existing?.duration_days?.toString() ?? "");
  const [visaNeeded, setVisaNeeded] = useState(existing?.visa_needed ?? false);
  const [vaccines, setVaccines] = useState(existing?.vaccines ?? "");
  const [transportMode, setTransportMode] = useState(existing?.transport_mode ?? "");
  const [intlPermitNeeded, setIntlPermitNeeded] = useState(existing?.intl_permit_needed ?? false);
  const [securityNotes, setSecurityNotes] = useState(existing?.security_notes ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const createEtape = useCreateEtape(voyageId);
  const updateEtape = useUpdateEtape(voyageId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      country_region: countryRegion,
      arrival_date: arrivalDate || null,
      duration_days: durationDays ? Number(durationDays) : null,
      visa_needed: visaNeeded,
      vaccines: vaccines || null,
      transport_mode: transportMode || null,
      intl_permit_needed: intlPermitNeeded,
      security_notes: securityNotes || null,
      notes: notes || null,
    };
    try {
      if (existing) {
        await updateEtape.mutateAsync({ id: existing.id, ...payload });
      } else {
        await createEtape.mutateAsync({ ...payload, order_index: nextOrder });
        setCountryRegion("");
        setArrivalDate("");
        setDurationDays("");
        setVisaNeeded(false);
        setVaccines("");
        setTransportMode("");
        setIntlPermitNeeded(false);
        setSecurityNotes("");
        setNotes("");
      }
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {existing ? (
          <Button variant="ghost" size="icon">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle étape
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Modifier l'étape" : "Nouvelle étape (pays/région)"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Pays / région</Label>
            <Input required value={countryRegion} onChange={(e) => setCountryRegion(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date d'arrivée</Label>
              <Input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Durée (jours)</Label>
              <Input type="number" min="0" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={visaNeeded} onCheckedChange={(c) => setVisaNeeded(!!c)} id="visa" />
            <Label htmlFor="visa">Visa nécessaire</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={intlPermitNeeded} onCheckedChange={(c) => setIntlPermitNeeded(!!c)} id="permit" />
            <Label htmlFor="permit">Permis international nécessaire</Label>
          </div>
          <div className="space-y-2">
            <Label>Vaccins recommandés</Label>
            <Input value={vaccines} onChange={(e) => setVaccines(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Mode de déplacement sur place</Label>
            <Input value={transportMode} onChange={(e) => setTransportMode(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Infos sécurité</Label>
            <Textarea value={securityNotes} onChange={(e) => setSecurityNotes(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Notes libres</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

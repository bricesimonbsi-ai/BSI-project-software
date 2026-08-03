import { useState } from "react";
import { useSousEtapes } from "@/features/voyages/use-sous-etapes";
import { useDeleteEtape } from "@/features/voyages/use-etapes";
import { SousEtapeCard } from "@/features/voyages/sous-etape-card";
import { SousEtapeDialog } from "@/features/voyages/sous-etape-dialog";
import { EtapeDialog } from "@/features/voyages/etape-dialog";
import { DocumentsPanel } from "@/features/projects/documents-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { VoyageEtape, VoyageEtapeBudgetSummary } from "@/types/database";
import { ChevronDown, ChevronUp, Trash2, ShieldAlert, Syringe, FileWarning } from "lucide-react";

export function EtapeCard({
  etape,
  projectId,
  referenceCurrency,
  budgetSummary,
}: {
  etape: VoyageEtape;
  projectId: string;
  referenceCurrency: string;
  budgetSummary?: VoyageEtapeBudgetSummary;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: sousEtapes } = useSousEtapes(expanded ? etape.id : undefined);
  const deleteEtape = useDeleteEtape(etape.voyage_id);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <button className="flex items-start gap-2 text-left" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="mt-1 h-4 w-4" /> : <ChevronDown className="mt-1 h-4 w-4" />}
            <div>
              <CardTitle className="text-base">{etape.country_region}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {formatDate(etape.arrival_date)}
                {etape.duration_days ? ` · ${etape.duration_days} j` : ""}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            {budgetSummary && (
              <Badge variant="secondary">
                {formatCurrency(budgetSummary.total_actual ?? budgetSummary.total_planned ?? 0, referenceCurrency)}
              </Badge>
            )}
            <EtapeDialog voyageId={etape.voyage_id} nextOrder={0} existing={etape} />
            <Button variant="ghost" size="icon" onClick={() => deleteEtape.mutate(etape.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {etape.visa_needed && (
              <Badge variant="outline">
                <FileWarning className="mr-1 h-3 w-3" /> Visa nécessaire
              </Badge>
            )}
            {etape.intl_permit_needed && <Badge variant="outline">Permis international</Badge>}
            {etape.vaccines && (
              <Badge variant="outline">
                <Syringe className="mr-1 h-3 w-3" /> {etape.vaccines}
              </Badge>
            )}
            {etape.security_notes && (
              <Badge variant="outline">
                <ShieldAlert className="mr-1 h-3 w-3" /> Sécurité
              </Badge>
            )}
          </div>
          {etape.transport_mode && (
            <p className="text-sm">
              <span className="font-medium">Déplacement sur place : </span>
              {etape.transport_mode}
            </p>
          )}
          {etape.security_notes && (
            <p className="text-sm">
              <span className="font-medium">Sécurité : </span>
              {etape.security_notes}
            </p>
          )}
          {etape.notes && (
            <p className="text-sm">
              <span className="font-medium">Notes : </span>
              {etape.notes}
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Villes / lieux</p>
              <SousEtapeDialog etapeId={etape.id} nextOrder={sousEtapes?.length ?? 0} />
            </div>
            <div className="space-y-2">
              {(sousEtapes ?? []).map((se) => (
                <SousEtapeCard key={se.id} sousEtape={se} referenceCurrency={referenceCurrency} />
              ))}
              {sousEtapes?.length === 0 && <p className="text-sm text-muted-foreground">Aucune ville ajoutée.</p>}
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-semibold">Documents de l'étape</p>
            <DocumentsPanel projectId={projectId} voyageEtapeId={etape.id} />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

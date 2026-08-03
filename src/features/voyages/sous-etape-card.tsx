import { useState } from "react";
import { useSousEtapeExpenses } from "@/features/voyages/use-expenses";
import { useDeleteSousEtape } from "@/features/voyages/use-sous-etapes";
import { ExpenseFormDialog } from "@/features/voyages/expense-form-dialog";
import { ExpenseList } from "@/features/voyages/expense-list";
import { ON_SITE_CATEGORIES } from "@/features/voyages/use-expenses";
import { SousEtapeDialog } from "@/features/voyages/sous-etape-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { VoyageSousEtape } from "@/types/database";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";

export function SousEtapeCard({ sousEtape, referenceCurrency }: { sousEtape: VoyageSousEtape; referenceCurrency: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data: expenses } = useSousEtapeExpenses(expanded ? sousEtape.id : undefined);
  const deleteSousEtape = useDeleteSousEtape(sousEtape.etape_id);

  return (
    <Card className="ml-4 border-l-4">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 text-left" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <div>
              <p className="font-medium">{sousEtape.city}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(sousEtape.start_date)} → {formatDate(sousEtape.end_date)}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-1">
            <SousEtapeDialog etapeId={sousEtape.etape_id} nextOrder={0} existing={sousEtape} />
            <Button variant="ghost" size="icon" onClick={() => deleteSousEtape.mutate(sousEtape.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="space-y-3 border-t border-border pt-3">
            {sousEtape.lodging && (
              <p className="text-sm">
                <span className="font-medium">Logement : </span>
                {sousEtape.lodging}
              </p>
            )}
            {sousEtape.activities && (
              <p className="text-sm">
                <span className="font-medium">Activités : </span>
                {sousEtape.activities}
              </p>
            )}
            {sousEtape.transport_next_mode && (
              <p className="text-sm">
                <span className="font-medium">Transport suivant : </span>
                {sousEtape.transport_next_mode}
                {sousEtape.transport_next_duration_hours ? ` · ${sousEtape.transport_next_duration_hours}h` : ""}
                {sousEtape.transport_next_cost
                  ? ` · ${sousEtape.transport_next_cost} ${sousEtape.transport_next_currency ?? ""}`
                  : ""}
              </p>
            )}

            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Dépenses sur place</p>
              <ExpenseFormDialog
                scope={{ sousEtapeId: sousEtape.id }}
                categories={ON_SITE_CATEGORIES}
                referenceCurrency={referenceCurrency}
                invalidateKey={["sous-etape-expenses", sousEtape.id]}
              />
            </div>
            <ExpenseList expenses={expenses ?? []} invalidateKey={["sous-etape-expenses", sousEtape.id]} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

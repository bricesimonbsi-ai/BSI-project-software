import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import { useProjectPeople } from "@/features/people/use-people";
import {
  useVoyageCategoryBudgetSummary,
  useVoyagePersonExpenseSummary,
  PRE_DEPARTURE_CATEGORIES,
  ON_SITE_CATEGORIES,
} from "@/features/voyages/use-expenses";
import { buildFlatRows, groupByCountry } from "@/features/voyages/itinerary/itinerary-model";
import { findCountryByName } from "@/features/voyages/itinerary/location-pickers";
import { estimateFlightsEur, estimateVisasEur } from "@/features/voyages/budget-estimate";
import { estimateLodgingAndFoodByCountry } from "@/features/voyages/cost-of-living";
import { BudgetRing } from "@/features/voyages/budget-ring";
import { formatCurrency } from "@/lib/utils";
import type { ExpenseCategory, TravelStyle, Voyage, VoyageSousEtape } from "@/types/database";

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  [...PRE_DEPARTURE_CATEGORIES, ...ON_SITE_CATEGORIES].map((c) => [c.value, c.label])
);

/** Catégories automatiquement complétées par l'estimation indicative (hébergement,
 * nourriture, vols, visas) — additionnées à ce qui a été saisi manuellement. */
const AUTO_ESTIMATE_CATEGORIES: ExpenseCategory[] = ["logement", "nourriture", "transport_international", "visas"];

/** Indicateurs budget (total, par personne, par catégorie) + estimation indicative fondue
 * directement dans les totaux affichés, et comparatif prévisionnel / réel en anneaux. */
export function BudgetInsights({ voyage, projectId }: { voyage: Voyage; projectId: string }) {
  const voyageId = voyage.id;
  const { data: etapes } = useEtapes(voyageId);
  const { data: allSousEtapes } = useVoyageSousEtapes(voyageId);
  const { data: linkedPeople } = useProjectPeople(projectId);
  const { data: categorySummary } = useVoyageCategoryBudgetSummary(voyageId);
  const { data: personSummary } = useVoyagePersonExpenseSummary(voyageId);

  const travelerCount = linkedPeople?.length || voyage.adults_count + voyage.children_count || 1;
  const style: TravelStyle = voyage.travel_style ?? "standard";

  const itinerary = useMemo(() => {
    const map = new Map<string, VoyageSousEtape[]>();
    for (const se of allSousEtapes ?? []) {
      const list = map.get(se.etape_id) ?? [];
      list.push(se);
      map.set(se.etape_id, list);
    }
    const flat = buildFlatRows(etapes ?? [], map);
    const groups = groupByCountry(etapes ?? [], flat);
    const flightKm = flat.reduce(
      (sum, r) => sum + (r.incomingMode?.toLowerCase().includes("avion") ? r.incomingDistanceKm ?? 0 : 0),
      0
    );
    const visaEtapeCount = (etapes ?? []).filter((e) => e.visa_needed).length;
    const countryNights = groups.map((g) => ({
      countryCode: findCountryByName(g.etape.country_region)?.cca2 ?? null,
      nights: g.totalNights,
    }));
    return { flightKm, visaEtapeCount, countryNights };
  }, [etapes, allSousEtapes]);

  const [autoEstimate, setAutoEstimate] = useState({ logement: 0, nourriture: 0, transport_international: 0, visas: 0 });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const { lodging, food } = await estimateLodgingAndFoodByCountry(
        itinerary.countryNights,
        style,
        travelerCount,
        voyage.lodging_count ?? travelerCount
      );
      if (cancelled) return;
      setAutoEstimate({
        logement: lodging,
        nourriture: food,
        transport_international: estimateFlightsEur(itinerary.flightKm, travelerCount),
        visas: estimateVisasEur(itinerary.visaEtapeCount, style, travelerCount),
      });
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [itinerary, style, travelerCount, voyage.lodging_count]);

  // Fond en dur les totaux saisis (par catégorie) avec l'estimation automatique, pour que
  // l'estimation alimente directement les indicateurs déjà affichés — pas d'encart séparé,
  // pas de fausses dépenses créées en base.
  const blendedCategories = useMemo(() => {
    const byCategory = new Map((categorySummary ?? []).map((c) => [c.category, c]));
    const allCategories = new Set<ExpenseCategory>([
      ...PRE_DEPARTURE_CATEGORIES.map((c) => c.value),
      ...ON_SITE_CATEGORIES.map((c) => c.value),
      ...(categorySummary ?? []).map((c) => c.category),
    ]);
    return Array.from(allCategories).map((category) => {
      const row = byCategory.get(category);
      const estimate = (autoEstimate as Record<string, number>)[category] ?? 0;
      return {
        category,
        label: CATEGORY_LABELS[category] ?? category,
        planned: (row?.total_planned ?? 0) + estimate,
        actual: row?.total_actual ?? 0,
        isEstimated: AUTO_ESTIMATE_CATEGORIES.includes(category) && estimate > 0,
      };
    });
  }, [categorySummary, autoEstimate]);

  // Le transport local (sur place) est exclu du budget prévisionnel total affiché — c'est
  // une dépense courante du quotidien du voyage, pas un poste à planifier à l'avance.
  const headlineRows = blendedCategories.filter((c) => c.category !== "transport_local" && (c.planned > 0 || c.actual > 0));
  const totalPlanned = headlineRows.reduce((sum, c) => sum + c.planned, 0);
  const totalActual = headlineRows.reduce((sum, c) => sum + c.actual, 0);
  const perPersonPlanned = totalPlanned / travelerCount;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-lg font-bold">{formatCurrency(totalPlanned, voyage.reference_currency)}</p>
            <p className="text-xs text-muted-foreground">Budget prévisionnel total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-lg font-bold">{formatCurrency(totalActual, voyage.reference_currency)}</p>
            <p className="text-xs text-muted-foreground">Dépenses réelles totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-lg font-bold">
              {formatCurrency(perPersonPlanned, voyage.reference_currency)}
              {voyage.budget_target_per_person ? (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  / cible {formatCurrency(voyage.budget_target_per_person, voyage.reference_currency)}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">Budget prévisionnel / personne ({travelerCount})</p>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">
        Le total exclut le transport local (dépense courante sur place, pas un poste à planifier à l'avance) et inclut une
        estimation automatique indicative pour l'hébergement et la nourriture (selon le style de voyage et le coût de la vie
        de chaque pays traversé), les vols inter-étapes et les visas — visible aussi dans le détail par catégorie ci-dessous.
        Style de voyage réglable dans l'onglet Aperçu.
      </p>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Comparatif prévisionnel / réel
        </h3>
        <div className="flex flex-wrap gap-4">
          <BudgetRing label="Ensemble du voyage" planned={totalPlanned} actual={totalActual} currency={voyage.reference_currency} size={112} />
          {headlineRows.map((c) => (
            <BudgetRing key={c.category} label={c.label} planned={c.planned} actual={c.actual} currency={voyage.reference_currency} />
          ))}
        </div>
      </div>

      {headlineRows.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Par grande catégorie (prévisionnel)
          </h3>
          <div className="space-y-2">
            {headlineRows
              .slice()
              .sort((a, b) => b.planned - a.planned)
              .map((c) => (
                <div key={c.category} className="flex items-center gap-3 text-sm">
                  <span className="w-40 flex-shrink-0 truncate">
                    {c.label}
                    {c.isEstimated && <span className="ml-1 text-xs text-muted-foreground">(inclut estimation)</span>}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(c.planned / Math.max(1, ...headlineRows.map((r) => r.planned))) * 100}%` }}
                    />
                  </div>
                  <span className="w-24 flex-shrink-0 text-right font-semibold">
                    {formatCurrency(c.planned, voyage.reference_currency)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {personSummary && personSummary.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dépenses rattachées à une personne
          </h3>
          <div className="space-y-1">
            {personSummary.map((p) => (
              <div key={p.person_id} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <span className="font-semibold">
                  {formatCurrency(p.total_planned ?? 0, voyage.reference_currency)} prévu ·{" "}
                  {formatCurrency(p.total_actual ?? 0, voyage.reference_currency)} réel
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useProjectPeople } from "@/features/people/use-people";
import { PersonAvatarBadge } from "@/features/people/person-avatar";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import {
  EXPENSE_CATEGORIES,
  CATEGORY_LABELS,
  TRANSPORT_SUB_CATEGORIES,
  ADMIN_SANTE_SUB_CATEGORIES,
  groupedCategory,
  groupedSubCategory,
  computeAdminSantePlannedBySubCategory,
  computeAdminSanteVisaPlannedTotal,
} from "@/features/voyages/use-expenses";
import {
  CategoryComparisonChart,
  ConsumedPctBadge,
  consumedPct,
  CATEGORY_HUE_HEX,
  type CategoryComparisonRow,
} from "@/features/voyages/category-comparison-chart";
import { CategoryBreakdownRing } from "@/features/voyages/budget-ring";
import { BudgetOverviewTable } from "@/features/voyages/budget-overview-table";
import { ManageExpensesTab } from "@/features/voyages/csv-import/manage-expenses-tab";
import { useVoyageBudgetTotals } from "@/features/voyages/use-voyage-budget-totals";
import { buildFlatRows } from "@/features/voyages/itinerary/itinerary-model";
import { buildBudgetTimeline, buildActualAmountByDate, todayISO } from "@/features/voyages/budget-timeline";
import { BudgetTimelineChart } from "@/features/voyages/budget-timeline-chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatCurrency } from "@/lib/utils";
import type { TravelStyle, Voyage, VoyageSousEtape } from "@/types/database";

type BudgetTab = "synthese" | "planned" | "actual" | "gerer";

const SUB_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  [...TRANSPORT_SUB_CATEGORIES, ...ADMIN_SANTE_SUB_CATEGORIES].map((s) => [s.value, s.label])
);

function toRows(map: Map<string, { planned: number; actual: number }>, labels: Record<string, string>): CategoryComparisonRow[] {
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, label: labels[key] ?? key, ...v }))
    .filter((r) => r.planned > 0 || r.actual > 0);
}

/** Combine un détail prévisionnel et un détail réel (deux listes {key,label,amount} séparées,
 * voir les anneaux de détail) en lignes {planned,actual} pour les sous-barres dépliables du
 * graphique en barres — mêmes clés/libellés que les anneaux, pour ne jamais afficher un détail
 * différent d'un graphique à l'autre. */
function mergeAmountItems(
  planned: { key: string; label: string; amount: number }[],
  actual: { key: string; label: string; amount: number }[]
): { key: string; label: string; planned: number; actual: number }[] {
  const byKey = new Map<string, { label: string; planned: number; actual: number }>();
  for (const p of planned) byKey.set(p.key, { label: p.label, planned: p.amount, actual: 0 });
  for (const a of actual) {
    const existing = byKey.get(a.key);
    if (existing) existing.actual = a.amount;
    else byKey.set(a.key, { label: a.label, planned: 0, actual: a.amount });
  }
  return Array.from(byKey.entries()).map(([key, v]) => ({ key, ...v }));
}

/**
 * Budget du voyage : deux chiffres clés (total du voyage / par personne, prévisionnel et
 * réel côte à côte pour ne jamais les confondre), un graphique de comparaison prévisionnel vs
 * réel par catégorie (les 6 catégories unifiées de l'application), le détail par sous-type pour
 * transport et administratif & santé sous forme d'anneaux, et le détail éditable en dessous —
 * tout calculé à partir de la même source (`voyage_all_expenses` + le calcul en direct du
 * logement/nourriture/transport sur place, voir useCityLockedCostsMap), donc chiffres,
 * graphiques et tableau coïncident toujours, sans délai de resynchronisation possible.
 */
export function BudgetInsights({ voyage, projectId }: { voyage: Voyage; projectId: string }) {
  const voyageId = voyage.id;
  const [budgetTab, setBudgetTab] = useState<BudgetTab>("synthese");
  const [chartView, setChartView] = useState<"bar" | "ring">("bar");
  const { data: linkedPeople } = useProjectPeople(projectId);
  const { data: etapes } = useEtapes(voyageId);
  const { data: allSousEtapes } = useVoyageSousEtapes(voyageId);

  // Même source unique que voyage-detail-page.tsx : la liste "Voyageurs" liée au projet.
  const travelerCount = linkedPeople?.length || 1;
  const style: TravelStyle = voyage.travel_style ?? "standard";
  const lodgingCount = voyage.lodging_count ?? travelerCount;

  // Source unique (voir use-voyage-budget-totals.ts) : partagée avec l'onglet Aperçu pour que les
  // deux affichent toujours exactement le même chiffre.
  const { expenses, equipmentPlannedTotal, lockedByCity, lockedTotal, adminSantePlannedTotalWithVisa, totalPlanned, totalActual } = useVoyageBudgetTotals({
    voyageId,
    travelStyle: style,
    travelerCount,
    lodgingCount,
  });

  const citiesByEtape = useMemo(() => {
    const map = new Map<string, VoyageSousEtape[]>();
    for (const se of allSousEtapes ?? []) {
      const list = map.get(se.etape_id) ?? [];
      list.push(se);
      map.set(se.etape_id, list);
    }
    return map;
  }, [allSousEtapes]);
  const flat = useMemo(() => buildFlatRows(etapes ?? [], citiesByEtape), [etapes, citiesByEtape]);

  // Chronologie prévisionnel/réel cumulés : réutilise cityColumnAmount/CITY_COLUMNS (source
  // unique déjà utilisée par le tableau détail des dépenses) pour ne jamais afficher un rythme
  // journalier différent des montants par ville affichés ailleurs.
  const expensesBySousEtape = useMemo(() => {
    const map = new Map<string, typeof expenses>();
    for (const e of expenses) {
      if (!e.planned || !e.sous_etape_id) continue;
      const list = map.get(e.sous_etape_id) ?? [];
      list.push(e);
      map.set(e.sous_etape_id, list);
    }
    return map;
  }, [expenses]);
  const timelinePoints = useMemo(() => {
    if (flat.length === 0) return [];
    const start = flat[0].sousEtape.start_date;
    const end = flat[flat.length - 1].sousEtape.end_date;
    if (!start || !end) return [];
    const actualAmountByDate = buildActualAmountByDate(
      expenses.filter((e) => !e.planned),
      start,
      end
    );
    return buildBudgetTimeline({
      flat,
      expensesBySousEtape,
      lockedByCity,
      upfrontPlanned: equipmentPlannedTotal + adminSantePlannedTotalWithVisa,
      actualAmountByDate,
    });
  }, [flat, expenses, expensesBySousEtape, lockedByCity, equipmentPlannedTotal, adminSantePlannedTotalWithVisa]);

  const { categoryRows, transportRows, adminSanteRows } = useMemo(() => {
    const byCategory = new Map<string, { planned: number; actual: number }>();
    const byTransportSub = new Map<string, { planned: number; actual: number }>();
    const byAdminSub = new Map<string, { planned: number; actual: number }>();
    for (const e of expenses) {
      const category = groupedCategory(e.category);
      const amount = e.amount * e.manual_rate_to_reference;
      const bucket = byCategory.get(category) ?? { planned: 0, actual: 0 };
      if (e.planned) bucket.planned += amount;
      else bucket.actual += amount;
      byCategory.set(category, bucket);

      if (category === "transport" || category === "administratif_sante") {
        const sub = groupedSubCategory(e);
        const target = category === "transport" ? byTransportSub : byAdminSub;
        const subBucket = target.get(sub) ?? { planned: 0, actual: 0 };
        if (e.planned) subBucket.planned += amount;
        else subBucket.actual += amount;
        target.set(sub, subBucket);
      }
    }
    return {
      categoryRows: toRows(byCategory, CATEGORY_LABELS),
      transportRows: toRows(byTransportSub, SUB_CATEGORY_LABELS),
      adminSanteRows: toRows(byAdminSub, SUB_CATEGORY_LABELS),
    };
  }, [expenses]);

  // Le détail dépliable de la barre Transport ne détaille QUE les trajets entre étapes par mode
  // (avion, train, ferry...), jamais le transport sur place (calculé en direct, sans mode
  // associé) — mêmes items que ceux réutilisés dans le détail par sous-type de l'anneau "Toutes
  // catégories" (voir mainPlannedItems/mainActualItems, qui eux gardent le total combiné).
  const transportPlannedItems = transportRows.filter((r) => r.planned > 0).map((r) => ({ key: r.key, label: r.label, amount: r.planned }));
  const transportActualItems = transportRows.filter((r) => r.actual > 0).map((r) => ({ key: r.key, label: r.label, amount: r.actual }));
  // Même source dédupliquée que adminSantePlannedTotal ci-dessus, pas adminSanteRows (qui
  // sommerait toutes les lignes correspondantes, doublons compris) — le visa y est rajouté à part
  // (voir computeAdminSanteVisaPlannedTotal) puisqu'il est saisi par pays, pas par voyage.
  const visaPlannedTotal = computeAdminSanteVisaPlannedTotal(expenses);
  const adminPlannedItems = [
    ...computeAdminSantePlannedBySubCategory(expenses, voyageId),
    ...(visaPlannedTotal > 0.01 ? [{ key: "visa", label: "Visa", amount: visaPlannedTotal }] : []),
  ];
  const adminActualItems = adminSanteRows.filter((r) => r.actual > 0).map((r) => ({ key: r.key, label: r.label, amount: r.actual }));
  // Même détail (et mêmes clés/libellés) que les anneaux ci-dessous, réutilisé comme sous-lignes
  // dépliables de la barre Transport / Administratif & santé — jamais un calcul indépendant qui
  // pourrait diverger de ce que montre l'anneau pour la même catégorie.
  const transportSubRows = mergeAmountItems(transportPlannedItems, transportActualItems);
  const adminSubRows = mergeAmountItems(adminPlannedItems, adminActualItems);

  // Toutes les catégories unifiées apparaissent dans le graphique principal, même à 0, pour que
  // sa forme (6 catégories fixes) reste stable d'un voyage à l'autre. Équipement, logement,
  // nourriture, transport sur place et administratif & santé sont injectés depuis leur calcul en
  // direct (voir plus haut), pas depuis categoryRows (qui compterait en double d'éventuelles
  // anciennes lignes en double pour administratif & santé).
  const mainRows: CategoryComparisonRow[] = EXPENSE_CATEGORIES.map((c) => {
    if (c.value === "equipement") return { key: "equipement", label: c.label, planned: equipmentPlannedTotal, actual: 0 };
    if (c.value === "logement") {
      const actual = categoryRows.find((r) => r.key === "logement")?.actual ?? 0;
      return { key: "logement", label: c.label, planned: lockedTotal.lodging, actual };
    }
    if (c.value === "nourriture") {
      const actual = categoryRows.find((r) => r.key === "nourriture")?.actual ?? 0;
      return { key: "nourriture", label: c.label, planned: lockedTotal.food, actual };
    }
    if (c.value === "transport") {
      const base = categoryRows.find((r) => r.key === "transport");
      return {
        key: "transport",
        label: c.label,
        planned: (base?.planned ?? 0) + lockedTotal.localTransport,
        actual: base?.actual ?? 0,
        subRows: transportSubRows,
      };
    }
    if (c.value === "administratif_sante") {
      const actual = categoryRows.find((r) => r.key === "administratif_sante")?.actual ?? 0;
      return { key: "administratif_sante", label: c.label, planned: adminSantePlannedTotalWithVisa, actual, subRows: adminSubRows };
    }
    return categoryRows.find((r) => r.key === c.value) ?? { key: c.value, label: c.label, planned: 0, actual: 0 };
  });

  // Vue "Cercle" du graphique principal : mêmes 6 catégories, mêmes couleurs que la vue "Barre"
  // (voir CATEGORY_HUE_HEX) pour qu'un basculement entre les deux vues reste immédiatement
  // reconnaissable catégorie par catégorie.
  const mainPlannedItems = mainRows
    .filter((r) => r.planned > 0)
    .map((r) => ({ key: r.key, label: r.label, amount: r.planned, color: CATEGORY_HUE_HEX[r.key] }));
  const mainActualItems = mainRows
    .filter((r) => r.actual > 0)
    .map((r) => ({ key: r.key, label: r.label, amount: r.actual, color: CATEGORY_HUE_HEX[r.key] }));

  const pendingReviewCount = expenses.filter((e) => e.needs_review).length;
  const globalPct = consumedPct(totalActual, totalPlanned);
  // Les montants saisis sont des totaux partagés, jamais rattachés à un voyageur en particulier
  // (voir plus haut pourquoi "Dépenses par personne" a été retiré) : le réel "par personne" est
  // donc la moyenne du total sur le nombre de voyageurs, comparée à la cible propre de CHAQUE
  // voyageur — deux voyageurs peuvent ainsi avoir un % très différent avec le même montant moyen,
  // selon leur propre budget cible.
  const actualPerTraveler = totalActual / travelerCount;

  return (
    <div className="space-y-5">
      <Tabs value={budgetTab} onValueChange={(v) => setBudgetTab(v as BudgetTab)}>
        <TabsList>
          <TabsTrigger value="synthese">Synthèse</TabsTrigger>
          <TabsTrigger value="planned">Prévisionnel</TabsTrigger>
          <TabsTrigger value="actual">Réel</TabsTrigger>
          <TabsTrigger value="gerer">
            Gérer mes dépenses
            {pendingReviewCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[0.65rem] font-bold text-amber-700 dark:text-amber-300">
                {pendingReviewCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {budgetTab === "gerer" && <ManageExpensesTab voyageId={voyageId} projectId={projectId} referenceCurrency={voyage.reference_currency} />}

      {(budgetTab === "planned" || budgetTab === "actual") && (
        <BudgetOverviewTable
          voyageId={voyageId}
          projectId={projectId}
          referenceCurrency={voyage.reference_currency}
          travelStyle={style}
          travelerCount={travelerCount}
          lodgingCount={lodgingCount}
          view={budgetTab}
        />
      )}

      {budgetTab === "synthese" && (
        <div className="space-y-5">
          {pendingReviewCount > 0 && (
            <button
              type="button"
              onClick={() => setBudgetTab("gerer")}
              className="w-full rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-sm font-medium text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
            >
              {pendingReviewCount} dépense{pendingReviewCount > 1 ? "s" : ""} importée{pendingReviewCount > 1 ? "s" : ""} à valider — cliquer pour
              les gérer
            </button>
          )}
          <Card>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-[auto,1fr] sm:items-center">
              <div className="flex flex-col justify-center gap-1 sm:border-r sm:border-border sm:pr-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total du voyage</p>
                <p className="whitespace-nowrap text-lg font-bold">
                  {formatCurrency(totalPlanned, voyage.reference_currency)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">prévu</span>
                </p>
                <p className="whitespace-nowrap text-lg font-bold">
                  {formatCurrency(totalActual, voyage.reference_currency)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">réel</span>
                </p>
              </div>

              <div className="flex flex-col justify-center gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-muted-foreground">Budget prévisionnel consommé</p>
                  <ConsumedPctBadge pct={globalPct} className="px-3 py-1 text-2xl font-bold sm:text-3xl" />
                </div>
                {linkedPeople && linkedPeople.length > 0 && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-sm text-muted-foreground">Par voyageur</p>
                    <div className="flex flex-wrap gap-3">
                      {linkedPeople.filter((l) => l.people).map((l, i) => (
                        <div key={l.person_id} className="flex items-center gap-3 rounded-md border border-border/70 px-3 py-2">
                          <PersonAvatarBadge
                            name={l.people.name}
                            avatarEmoji={l.people.avatar_emoji}
                            avatarConfig={l.people.avatar_config}
                            personId={l.people.id}
                            index={i}
                            className="h-8 w-8 text-sm"
                          />
                          <div>
                            <p className="text-sm font-semibold leading-tight">{l.people.name}</p>
                            <p className="text-xs leading-tight text-muted-foreground">
                              <span className="font-semibold text-foreground">{formatCurrency(actualPerTraveler, voyage.reference_currency)}</span> dépensés à
                              ce jour
                            </p>
                          </div>
                          <div className="ml-2 border-l border-border pl-3 text-center">
                            {l.budget_target != null ? (
                              <>
                                <ConsumedPctBadge
                                  pct={consumedPct(actualPerTraveler, l.budget_target)}
                                  className="px-2 py-0.5 text-base font-bold"
                                  title={`${formatCurrency(actualPerTraveler, voyage.reference_currency)} / cible ${formatCurrency(l.budget_target, voyage.reference_currency)}`}
                                />
                                <p className="mt-0.5 whitespace-nowrap text-[0.65rem] text-muted-foreground">
                                  du budget cible ({formatCurrency(l.budget_target, voyage.reference_currency)})
                                </p>
                              </>
                            ) : (
                              <span
                                className="rounded-full bg-destructive/10 px-2 py-0.5 text-sm font-medium text-destructive"
                                title="Budget cible non renseigné (voir onglet Aperçu)"
                              >
                                cible manquante
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rythme de consommation dans le temps</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Prévu vs réel cumulés au fil de l'itinéraire — à distinguer du % ci-dessus (qui compare le réel au budget total final, pas au
              rythme attendu à ce stade du voyage).
            </p>
            <BudgetTimelineChart points={timelinePoints} todayDate={todayISO()} currency={voyage.reference_currency} />
          </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévisionnel / réel par catégorie</h3>
          <div className="inline-flex rounded-md border border-border p-0.5">
            <button
              type="button"
              onClick={() => setChartView("bar")}
              className={cn("rounded px-3 py-1 text-xs font-medium", chartView === "bar" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
            >
              Barres
            </button>
            <button
              type="button"
              onClick={() => setChartView("ring")}
              className={cn("rounded px-3 py-1 text-xs font-medium", chartView === "ring" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
            >
              Cercle
            </button>
          </div>
        </div>
        {chartView === "bar" ? (
          <CategoryComparisonChart rows={mainRows} currency={voyage.reference_currency} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <CategoryBreakdownRing title="Total dépenses prévisionnelles" total={totalPlanned} items={mainPlannedItems} currency={voyage.reference_currency} size={140} strokeWidth={18} />
            <CategoryBreakdownRing title="Total dépenses réelles" total={totalActual} items={mainActualItems} currency={voyage.reference_currency} size={140} strokeWidth={18} />
          </div>
        )}
      </div>
        </div>
      )}
    </div>
  );
}

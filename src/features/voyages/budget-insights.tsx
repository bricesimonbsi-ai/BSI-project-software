import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useProjectPeople } from "@/features/people/use-people";
import { PersonAvatarBadge } from "@/features/people/person-avatar";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import {
  useVoyageAllExpenses,
  EXPENSE_CATEGORIES,
  CATEGORY_LABELS,
  TRANSPORT_SUB_CATEGORIES,
  ADMIN_SANTE_SUB_CATEGORIES,
  groupedCategory,
  groupedSubCategory,
  computeAdminSantePlannedBySubCategory,
  computeAdminSantePlannedTotal,
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
import { useVoyageEquipment } from "@/features/voyages/use-voyage-equipment";
import { computeEquipmentPlannedTotal } from "@/features/voyages/equipment-pricing";
import { useCityLockedCostsMap, isLegacyLockedPlannedRow } from "@/features/voyages/use-city-locked-costs";
import { cn, formatCurrency } from "@/lib/utils";
import type { TravelStyle, Voyage } from "@/types/database";

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
  const [chartView, setChartView] = useState<"bar" | "ring">("bar");
  const { data: linkedPeople } = useProjectPeople(projectId);
  const { data: allExpenses } = useVoyageAllExpenses(voyageId);
  const { data: equipmentItems } = useVoyageEquipment(voyageId);
  const { data: etapes } = useEtapes(voyageId);
  const { data: allSousEtapes } = useVoyageSousEtapes(voyageId);

  // Même source unique que voyage-detail-page.tsx : la liste "Voyageurs" liée au projet.
  const travelerCount = linkedPeople?.length || 1;
  const style: TravelStyle = voyage.travel_style ?? "standard";
  const lodgingCount = voyage.lodging_count ?? travelerCount;

  const { total: lockedTotal } = useCityLockedCostsMap({
    etapes,
    sousEtapes: allSousEtapes,
    travelStyle: style,
    travelerCount,
    lodgingCount,
  });

  // L'équipement et les coûts verrouillés (logement/nourriture/transport sur place) ne sont
  // plus des lignes de dépense à resynchroniser : leur coût prévisionnel est calculé en direct
  // (toujours à jour, sans décalage). D'éventuelles anciennes lignes correspondantes dans
  // voyage_expenses sont ignorées pour ne pas compter en double.
  const expenses = (allExpenses ?? []).filter((e) => groupedCategory(e.category) !== "equipement" && !isLegacyLockedPlannedRow(e));
  const equipmentPlannedTotal = computeEquipmentPlannedTotal(equipmentItems ?? []);
  const lockedPlannedTotal = lockedTotal.lodging + lockedTotal.food + lockedTotal.localTransport;
  // Source unique (voir use-expenses.ts) : partagée avec budget-overview-table.tsx pour que le
  // tableau et ce résumé affichent toujours exactement le même chiffre (jamais une somme brute
  // de toutes les lignes en base, qui compterait en double d'éventuelles anciennes lignes
  // devenues invisibles dans la grille).
  const adminSantePlannedTotal = computeAdminSantePlannedTotal(expenses, voyageId);
  // Le visa est exclu de adminSantePlannedTotal (voir use-expenses.ts) car saisi par pays, pas
  // par voyage — recompté ici à part pour ne pas disparaître du total général ni du graphique.
  const visaPlannedTotal = computeAdminSanteVisaPlannedTotal(expenses);
  const adminSantePlannedTotalWithVisa = adminSantePlannedTotal + visaPlannedTotal;

  const totalPlanned =
    expenses
      .filter((e) => e.planned && groupedCategory(e.category) !== "administratif_sante")
      .reduce((s, e) => s + e.amount * e.manual_rate_to_reference, 0) +
    adminSantePlannedTotalWithVisa +
    equipmentPlannedTotal +
    lockedPlannedTotal;
  const totalActual = expenses.filter((e) => !e.planned).reduce((s, e) => s + e.amount * e.manual_rate_to_reference, 0);

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

  // L'anneau Transport (et le détail dépliable de la barre Transport ci-dessous) ne détaille QUE
  // les trajets entre étapes par mode (avion, train, ferry...), jamais le transport sur place
  // (calculé en direct, sans mode associé) — donc son propre total exclut lockedTotal.localTransport,
  // contrairement à celui du graphique en barres qui regroupe les deux sous la même catégorie
  // "Transport".
  const transportLegPlannedTotal = categoryRows.find((r) => r.key === "transport")?.planned ?? 0;
  const transportLegActualTotal = categoryRows.find((r) => r.key === "transport")?.actual ?? 0;
  const transportPlannedItems = transportRows.filter((r) => r.planned > 0).map((r) => ({ key: r.key, label: r.label, amount: r.planned }));
  const transportActualItems = transportRows.filter((r) => r.actual > 0).map((r) => ({ key: r.key, label: r.label, amount: r.actual }));
  // Même source dédupliquée que adminSantePlannedTotal ci-dessus, pas adminSanteRows (qui
  // sommerait toutes les lignes correspondantes, doublons compris) — le visa y est rajouté à part
  // (voir computeAdminSanteVisaPlannedTotal) puisqu'il est saisi par pays, pas par voyage.
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

  const adminRow = mainRows.find((r) => r.key === "administratif_sante")!;
  // Vue "Cercle" du graphique principal : mêmes 6 catégories, mêmes couleurs que la vue "Barre"
  // (voir CATEGORY_HUE_HEX) pour qu'un basculement entre les deux vues reste immédiatement
  // reconnaissable catégorie par catégorie.
  const mainPlannedItems = mainRows
    .filter((r) => r.planned > 0)
    .map((r) => ({ key: r.key, label: r.label, amount: r.planned, color: CATEGORY_HUE_HEX[r.key] }));
  const mainActualItems = mainRows
    .filter((r) => r.actual > 0)
    .map((r) => ({ key: r.key, label: r.label, amount: r.actual, color: CATEGORY_HUE_HEX[r.key] }));

  const globalPct = consumedPct(totalActual, totalPlanned);
  // Les montants saisis sont des totaux partagés, jamais rattachés à un voyageur en particulier
  // (voir plus haut pourquoi "Dépenses par personne" a été retiré) : le réel "par personne" est
  // donc la moyenne du total sur le nombre de voyageurs, comparée à la cible propre de CHAQUE
  // voyageur — deux voyageurs peuvent ainsi avoir un % très différent avec le même montant moyen,
  // selon leur propre budget cible.
  const actualPerTraveler = totalActual / travelerCount;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-muted-foreground">Budget prévisionnel consommé</p>
            <ConsumedPctBadge pct={globalPct} className="px-3 py-1 text-2xl font-bold sm:text-3xl" />
          </div>
          {linkedPeople && linkedPeople.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
              {linkedPeople.map((l, i) => (
                <div key={l.person_id} className="flex items-center gap-1.5">
                  <PersonAvatarBadge name={l.people.name} avatarEmoji={l.people.avatar_emoji} index={i} className="h-6 w-6 text-xs" />
                  <span className="text-xs text-muted-foreground">{l.people.name}</span>
                  {l.budget_target != null ? (
                    <ConsumedPctBadge
                      pct={consumedPct(actualPerTraveler, l.budget_target)}
                      className="text-[0.7rem]"
                      title={`${formatCurrency(actualPerTraveler, voyage.reference_currency)} / cible ${formatCurrency(l.budget_target, voyage.reference_currency)}`}
                    />
                  ) : (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[0.7rem] font-medium text-destructive" title="Budget cible non renseigné (voir onglet Aperçu)">
                      cible manquante
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total du voyage</p>
            <p className="text-lg font-bold">
              {formatCurrency(totalPlanned, voyage.reference_currency)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">prévu</span>
            </p>
            <p className="text-lg font-bold">
              {formatCurrency(totalActual, voyage.reference_currency)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">réel</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Par personne ({travelerCount})</p>
              {linkedPeople && linkedPeople.length > 0 && (
                <div className="flex -space-x-1.5">
                  {linkedPeople.map((l, i) => (
                    <PersonAvatarBadge
                      key={l.person_id}
                      name={l.people.name}
                      avatarEmoji={l.people.avatar_emoji}
                      index={i}
                      className="h-6 w-6 border-2 border-card text-xs"
                    />
                  ))}
                </div>
              )}
            </div>
            <p className="text-lg font-bold">
              {formatCurrency(totalPlanned / travelerCount, voyage.reference_currency)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">prévu</span>
            </p>
            <p className="text-lg font-bold">
              {formatCurrency(totalActual / travelerCount, voyage.reference_currency)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">réel</span>
            </p>
          </CardContent>
        </Card>
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
            <CategoryBreakdownRing title="Toutes catégories · prévisionnel" total={totalPlanned} items={mainPlannedItems} currency={voyage.reference_currency} size={140} />
            <CategoryBreakdownRing title="Toutes catégories · réel" total={totalActual} items={mainActualItems} currency={voyage.reference_currency} size={140} />
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Détail transport et administratif & santé</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <CategoryBreakdownRing title="Transport · prévisionnel" total={transportLegPlannedTotal} items={transportPlannedItems} currency={voyage.reference_currency} />
          <CategoryBreakdownRing title="Transport · réel" total={transportLegActualTotal} items={transportActualItems} currency={voyage.reference_currency} />
          <CategoryBreakdownRing title="Admin. & santé · prévisionnel" total={adminRow.planned} items={adminPlannedItems} currency={voyage.reference_currency} />
          <CategoryBreakdownRing title="Admin. & santé · réel" total={adminRow.actual} items={adminActualItems} currency={voyage.reference_currency} />
        </div>
      </div>

      <BudgetOverviewTable
        voyageId={voyageId}
        projectId={projectId}
        referenceCurrency={voyage.reference_currency}
        travelStyle={style}
        travelerCount={travelerCount}
        lodgingCount={lodgingCount}
      />
    </div>
  );
}

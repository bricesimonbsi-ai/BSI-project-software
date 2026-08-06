import { useMemo } from "react";
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
import { CategoryComparisonChart, type CategoryComparisonRow } from "@/features/voyages/category-comparison-chart";
import { CategoryBreakdownRing } from "@/features/voyages/budget-ring";
import { BudgetOverviewTable } from "@/features/voyages/budget-overview-table";
import { useVoyageEquipment } from "@/features/voyages/use-voyage-equipment";
import { computeEquipmentPlannedTotal } from "@/features/voyages/equipment-pricing";
import { useCityLockedCostsMap, isLegacyLockedPlannedRow } from "@/features/voyages/use-city-locked-costs";
import { formatCurrency } from "@/lib/utils";
import type { TravelStyle, Voyage } from "@/types/database";

const SUB_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  [...TRANSPORT_SUB_CATEGORIES, ...ADMIN_SANTE_SUB_CATEGORIES].map((s) => [s.value, s.label])
);

function toRows(map: Map<string, { planned: number; actual: number }>, labels: Record<string, string>): CategoryComparisonRow[] {
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, label: labels[key] ?? key, ...v }))
    .filter((r) => r.planned > 0 || r.actual > 0);
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
      return { key: "transport", label: c.label, planned: (base?.planned ?? 0) + lockedTotal.localTransport, actual: base?.actual ?? 0 };
    }
    if (c.value === "administratif_sante") {
      const actual = categoryRows.find((r) => r.key === "administratif_sante")?.actual ?? 0;
      return { key: "administratif_sante", label: c.label, planned: adminSantePlannedTotalWithVisa, actual };
    }
    return categoryRows.find((r) => r.key === c.value) ?? { key: c.value, label: c.label, planned: 0, actual: 0 };
  });

  const adminRow = mainRows.find((r) => r.key === "administratif_sante")!;

  // L'anneau Transport ne détaille QUE les trajets entre étapes par mode (avion, train, ferry...),
  // jamais le transport sur place (calculé en direct, sans mode associé) — donc son propre total
  // exclut lockedTotal.localTransport, contrairement à celui du graphique en barres ci-dessus qui
  // regroupe les deux sous la même catégorie "Transport".
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

  return (
    <div className="space-y-5">
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
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                prévu{voyage.budget_target_per_person ? ` / cible ${formatCurrency(voyage.budget_target_per_person, voyage.reference_currency)}` : ""}
              </span>
            </p>
            <p className="text-lg font-bold">
              {formatCurrency(totalActual / travelerCount, voyage.reference_currency)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">réel</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévisionnel / réel par catégorie</h3>
        <CategoryComparisonChart rows={mainRows} currency={voyage.reference_currency} />
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

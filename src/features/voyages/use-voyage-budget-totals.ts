import {
  useVoyageAllExpenses,
  groupedCategory,
  computeAdminSantePlannedTotal,
  computeAdminSanteVisaPlannedTotal,
} from "@/features/voyages/use-expenses";
import { useVoyageEquipment } from "@/features/voyages/use-voyage-equipment";
import { computeEquipmentPlannedTotal } from "@/features/voyages/equipment-pricing";
import { useCityLockedCostsMap, isLegacyLockedPlannedRow } from "@/features/voyages/use-city-locked-costs";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import type { TravelStyle } from "@/types/database";

/**
 * Source UNIQUE du budget prévisionnel/réel total d'un voyage : équipement (table à part,
 * jamais dans voyage_expenses) + coûts verrouillés calculés en direct (logement/nourriture/
 * transport sur place, jamais des lignes à resynchroniser) + le reste des dépenses. Utilisée à
 * la fois par l'onglet Budget et la synthèse visuelle de l'onglet Aperçu, pour qu'ils n'affichent
 * JAMAIS deux chiffres différents — contrairement à l'ancienne vue SQL `voyage_budget_summary`,
 * qui sommait naïvement `voyage_expenses` sans connaître ni l'équipement ni l'exclusion des
 * anciennes lignes verrouillées désormais calculées en direct, devenue incohérente avec le reste
 * de l'application depuis ce refactor (c'est la cause du chiffre différent entre Aperçu et Budget).
 */
export function useVoyageBudgetTotals({
  voyageId,
  travelStyle,
  travelerCount,
  lodgingCount,
}: {
  voyageId: string | undefined;
  travelStyle: TravelStyle;
  travelerCount: number;
  lodgingCount: number;
}) {
  const { data: allExpenses } = useVoyageAllExpenses(voyageId);
  const { data: equipmentItems } = useVoyageEquipment(voyageId);
  const { data: etapes } = useEtapes(voyageId);
  const { data: allSousEtapes } = useVoyageSousEtapes(voyageId);

  const { byCity: lockedByCity, total: lockedTotal } = useCityLockedCostsMap({
    etapes,
    sousEtapes: allSousEtapes,
    travelStyle,
    travelerCount,
    lodgingCount,
  });

  const expenses = (allExpenses ?? []).filter((e) => groupedCategory(e.category) !== "equipement" && !isLegacyLockedPlannedRow(e));
  const equipmentPlannedTotal = computeEquipmentPlannedTotal(equipmentItems ?? []);
  const lockedPlannedTotal = lockedTotal.lodging + lockedTotal.food + lockedTotal.localTransport;
  const adminSantePlannedTotal = computeAdminSantePlannedTotal(expenses, voyageId ?? "");
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

  return {
    expenses,
    equipmentPlannedTotal,
    lockedByCity,
    lockedTotal,
    adminSantePlannedTotalWithVisa,
    totalPlanned,
    totalActual,
  };
}

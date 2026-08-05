import { useEffect, useMemo, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EQUIPMENT_CATALOG } from "@/features/voyages/equipment-catalog";
import {
  useVoyageEquipment,
  useCheckEquipment,
  useUncheckEquipment,
  useUpdateEquipmentQuantity,
  useUpdateEquipmentPrice,
} from "@/features/voyages/use-voyage-equipment";
import { useVoyageExpenses, useCreateExpense, useUpdateExpense } from "@/features/voyages/use-expenses";
import { DEFAULT_EQUIPMENT_UNIT_PRICE_EUR } from "@/features/voyages/budget-estimate";
import { cn, formatCurrency } from "@/lib/utils";
import type { VoyageEquipment } from "@/types/database";
import { ChevronRight, Plus } from "lucide-react";

/**
 * Synchronise en continu la ligne de dépense "equipement" (voyage_expenses, prévisionnelle) sur
 * la somme des articles cochés — jamais de saisie manuelle directe sur ce total : la source de
 * vérité, c'est le prix par article ci-dessous, donc ce total reste toujours son exact reflet
 * (et alimente automatiquement le tableau détail des dépenses de l'onglet Budget).
 */
function useSyncEquipmentTotal(voyageId: string, referenceCurrency: string, totalCost: number) {
  const { data: voyageExpenses } = useVoyageExpenses(voyageId);
  const existing = (voyageExpenses ?? []).find((e) => e.planned && e.category === "equipement");
  const createExpense = useCreateExpense({ voyageId }, ["voyage-all-expenses", voyageId]);
  const updateExpense = useUpdateExpense(["voyage-all-expenses", voyageId]);
  const creatingRef = useRef(false);

  useEffect(() => {
    const rounded = Math.round(totalCost * 100) / 100;
    if (!existing) {
      if (creatingRef.current || rounded <= 0) return;
      creatingRef.current = true;
      createExpense.mutate({
        category: "equipement",
        planned: true,
        amount: rounded,
        currency: referenceCurrency,
        manual_rate_to_reference: 1,
        is_estimated: true,
      });
      return;
    }
    if (Math.abs(existing.amount - rounded) > 0.01) {
      updateExpense.mutate({ id: existing.id, amount: rounded });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCost, existing]);

  return existing?.amount ?? 0;
}

/**
 * Liste de matériel à cocher (catalogue de base statique, ~370 articles), quantité et prix
 * unitaire ajustables article par article. Cocher un article crée automatiquement une tâche
 * "Prévoir : ..." dans l'onglet Tâches (voir le trigger sync_equipment_todo côté base) ;
 * décocher la supprime. Le récapitulatif du haut liste chaque article coché avec sa quantité et
 * son prix (unitaire ET total, l'un et l'autre bien distingués), et son total général alimente
 * automatiquement le tableau détail des dépenses prévisionnelles de l'onglet Budget.
 */
export function EquipmentTab({ voyageId, referenceCurrency }: { voyageId: string; referenceCurrency: string }) {
  const { data: equipment } = useVoyageEquipment(voyageId);
  const checkItem = useCheckEquipment(voyageId);
  const uncheckItem = useUncheckEquipment(voyageId);
  const updateQty = useUpdateEquipmentQuantity(voyageId);
  const updatePrice = useUpdateEquipmentPrice(voyageId);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [customNames, setCustomNames] = useState<Record<string, string>>({});

  const byKey = useMemo(() => {
    const map = new Map<string, VoyageEquipment>();
    for (const e of equipment ?? []) map.set(`${e.category}::${e.name}`, e);
    return map;
  }, [equipment]);

  const customByCategory = useMemo(() => {
    const catalogNames = new Set(EQUIPMENT_CATALOG.flatMap((g) => g.items));
    const map = new Map<string, VoyageEquipment[]>();
    for (const e of equipment ?? []) {
      if (catalogNames.has(e.name)) continue;
      const list = map.get(e.category) ?? [];
      list.push(e);
      map.set(e.category, list);
    }
    return map;
  }, [equipment]);

  const items = equipment ?? [];
  const totalCost = items.reduce((s, e) => s + e.quantity * (e.unit_price ?? DEFAULT_EQUIPMENT_UNIT_PRICE_EUR), 0);
  useSyncEquipmentTotal(voyageId, referenceCurrency, totalCost);

  function handleAddCustom(category: string) {
    const name = (customNames[category] ?? "").trim();
    if (!name) return;
    checkItem.mutate({ category, name });
    setCustomNames((c) => ({ ...c, [category]: "" }));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">Récapitulatif ({items.length} article{items.length > 1 ? "s" : ""})</p>
          <p className="text-xs text-muted-foreground">
            Chaque case cochée crée une tâche "Prévoir : ..." dans l'onglet Tâches ; le total ci-dessous alimente
            automatiquement le détail des dépenses prévisionnelles de l'onglet Budget.
          </p>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun article coché pour l'instant — coche-en ci-dessous.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2">Équipement nécessaire</th>
                  <th className="px-2 py-2 text-right">Quantité</th>
                  <th className="px-2 py-2 text-right">Prix unitaire estimé</th>
                  <th className="px-3 py-2 text-right">Prix total estimé</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const unitPrice = item.unit_price ?? DEFAULT_EQUIPMENT_UNIT_PRICE_EUR;
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-1.5">{item.name}</td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateQty.mutate({ id: item.id, quantity: Math.max(1, Number(e.target.value) || 1) })}
                          className="ml-auto h-7 w-16 text-right text-xs"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          defaultValue={unitPrice}
                          onBlur={(e) => {
                            const v = e.target.value.trim() === "" ? null : Math.max(0, Number(e.target.value));
                            updatePrice.mutate({ id: item.id, unit_price: v });
                          }}
                          className="ml-auto h-7 w-20 text-right text-xs"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium">
                        {formatCurrency(item.quantity * unitPrice, referenceCurrency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/40 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>
                    Total général
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(totalCost, referenceCurrency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {EQUIPMENT_CATALOG.map((group) => {
          const isOpen = !(collapsed[group.category] ?? true);
          const checkedInGroup =
            group.items.filter((name) => byKey.has(`${group.category}::${name}`)).length +
            (customByCategory.get(group.category)?.length ?? 0);
          return (
            <div key={group.category} className="rounded-md border border-border">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                onClick={() => setCollapsed((c) => ({ ...c, [group.category]: isOpen }))}
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
                  {group.category}
                </span>
                <span className="text-xs text-muted-foreground">{checkedInGroup} sélectionné(s)</span>
              </button>
              {isOpen && (
                <div className="grid grid-cols-1 gap-1 border-t border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((name) => {
                    const row = byKey.get(`${group.category}::${name}`);
                    return (
                      <EquipmentRow
                        key={name}
                        checked={!!row}
                        label={name}
                        onToggle={(checked) =>
                          checked ? checkItem.mutate({ category: group.category, name }) : row && uncheckItem.mutate(row.id)
                        }
                      />
                    );
                  })}
                  {(customByCategory.get(group.category) ?? []).map((row) => (
                    <EquipmentRow key={row.id} checked label={row.name} onToggle={() => uncheckItem.mutate(row.id)} />
                  ))}
                  <div className="flex items-center gap-1.5 sm:col-span-2 lg:col-span-3">
                    <Input
                      placeholder="Ajouter un article..."
                      value={customNames[group.category] ?? ""}
                      onChange={(e) => setCustomNames((c) => ({ ...c, [group.category]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddCustom(group.category))}
                      className="h-8 text-sm"
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => handleAddCustom(group.category)}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EquipmentRow({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50">
      <Checkbox checked={checked} onCheckedChange={(c) => onToggle(!!c)} />
      <span className="flex-1 text-sm">{label}</span>
    </div>
  );
}

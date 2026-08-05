import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EQUIPMENT_CATALOG } from "@/features/voyages/equipment-catalog";
import {
  useVoyageEquipment,
  useCheckEquipment,
  useUncheckEquipment,
  useUpdateEquipmentQuantity,
} from "@/features/voyages/use-voyage-equipment";
import { useVoyageExpenses } from "@/features/voyages/use-expenses";
import { EditableExpenseAmount } from "@/features/voyages/editable-expense-amount";
import { estimateEquipmentCostEur } from "@/features/voyages/budget-estimate";
import { cn } from "@/lib/utils";
import type { VoyageEquipment } from "@/types/database";
import { ChevronRight, Plus } from "lucide-react";

/**
 * Liste de matériel à cocher (catalogue de base statique, ~370 articles), quantité ajustable.
 * Cocher un article crée automatiquement une tâche "Prévoir : ..." dans l'onglet Tâches
 * (voir le trigger sync_equipment_todo côté base) ; décocher la supprime. Le coût prévisionnel
 * équipement est une seule case éditable (comme les autres catégories), pré-remplie à partir
 * du nombre total d'articles cochés.
 */
export function EquipmentTab({ voyageId, referenceCurrency }: { voyageId: string; referenceCurrency: string }) {
  const { data: equipment } = useVoyageEquipment(voyageId);
  const { data: voyageExpenses } = useVoyageExpenses(voyageId);
  const checkItem = useCheckEquipment(voyageId);
  const uncheckItem = useUncheckEquipment(voyageId);
  const updateQty = useUpdateEquipmentQuantity(voyageId);
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

  const totalQuantity = (equipment ?? []).reduce((s, e) => s + e.quantity, 0);
  const plannedEquipmentExpense = (voyageExpenses ?? []).find((e) => e.planned && e.category === "equipement");

  function handleAddCustom(category: string) {
    const name = (customNames[category] ?? "").trim();
    if (!name) return;
    checkItem.mutate({ category, name });
    setCustomNames((c) => ({ ...c, [category]: "" }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border p-4">
        <div>
          <p className="text-sm font-semibold">
            {equipment?.length ?? 0} article{(equipment?.length ?? 0) > 1 ? "s" : ""} coché(s) · {totalQuantity} au total
          </p>
          <p className="text-xs text-muted-foreground">Chaque case cochée crée une tâche "Prévoir : ..." dans l'onglet Tâches.</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Coût prévisionnel équipement</Label>
          <EditableExpenseAmount
            scope={{ voyageId }}
            category="equipement"
            planned
            existing={plannedEquipmentExpense}
            estimate={estimateEquipmentCostEur(totalQuantity)}
            referenceCurrency={referenceCurrency}
            invalidateKey={["voyage-all-expenses", voyageId]}
            className="w-28"
          />
        </div>
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
                        quantity={row?.quantity ?? 1}
                        onToggle={(checked) =>
                          checked ? checkItem.mutate({ category: group.category, name }) : row && uncheckItem.mutate(row.id)
                        }
                        onQuantityChange={(q) => row && updateQty.mutate({ id: row.id, quantity: q })}
                      />
                    );
                  })}
                  {(customByCategory.get(group.category) ?? []).map((row) => (
                    <EquipmentRow
                      key={row.id}
                      checked
                      label={row.name}
                      quantity={row.quantity}
                      onToggle={() => uncheckItem.mutate(row.id)}
                      onQuantityChange={(q) => updateQty.mutate({ id: row.id, quantity: q })}
                    />
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
  quantity,
  onToggle,
  onQuantityChange,
}: {
  checked: boolean;
  label: string;
  quantity: number;
  onToggle: (checked: boolean) => void;
  onQuantityChange: (quantity: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/50">
      <Checkbox checked={checked} onCheckedChange={(c) => onToggle(!!c)} />
      <span className="flex-1 text-sm">{label}</span>
      {checked && (
        <Input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => onQuantityChange(Math.max(1, Number(e.target.value) || 1))}
          className="h-7 w-14 text-xs"
        />
      )}
    </div>
  );
}

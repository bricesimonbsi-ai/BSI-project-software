import { useMemo, useState } from "react";
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
  useUpdateEquipmentOwned,
} from "@/features/voyages/use-voyage-equipment";
import { estimateEquipmentUnitPrice, computeEquipmentPlannedTotal } from "@/features/voyages/equipment-pricing";
import { cn, formatCurrency } from "@/lib/utils";
import type { VoyageEquipment } from "@/types/database";
import { ChevronRight, Plus } from "lucide-react";

/**
 * Liste de matériel à cocher (catalogue de base statique, ~370 articles), quantité et prix
 * unitaire ajustables article par article. Cocher un article crée automatiquement une tâche
 * "Prévoir : ..." dans l'onglet Tâches (voir le trigger sync_equipment_todo côté base) ;
 * décocher la supprime. Marquer un article comme "déjà possédé" retire son coût et sa tâche —
 * il reste simplement listé comme à emporter. Le total prévisionnel (somme des articles pas
 * encore possédés) est calculé en direct depuis cette liste partout où il est affiché (onglet
 * Budget compris) : pas de ligne de dépense intermédiaire à resynchroniser, donc jamais de
 * décalage entre les deux onglets.
 */
export function EquipmentTab({ voyageId, referenceCurrency }: { voyageId: string; referenceCurrency: string }) {
  const { data: equipment } = useVoyageEquipment(voyageId);
  const checkItem = useCheckEquipment(voyageId);
  const uncheckItem = useUncheckEquipment(voyageId);
  const updateQty = useUpdateEquipmentQuantity(voyageId);
  const updatePrice = useUpdateEquipmentPrice(voyageId);
  const updateOwned = useUpdateEquipmentOwned(voyageId);
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
  const totalCost = computeEquipmentPlannedTotal(items);

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
            Chaque case cochée crée une tâche "Prévoir : ..." dans l'onglet Tâches (sauf si déjà possédé) ; le total
            ci-dessous alimente automatiquement le détail des dépenses prévisionnelles de l'onglet Budget.
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
                  <th className="px-2 py-2 text-center">Déjà possédé</th>
                  <th className="px-2 py-2 text-right">Prix unitaire estimé</th>
                  <th className="px-3 py-2 text-right">Prix total estimé</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const unitPrice = item.unit_price ?? estimateEquipmentUnitPrice(item.name, item.category);
                  return (
                    <tr key={item.id} className={cn("border-b border-border last:border-0", item.owned && "opacity-50")}>
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
                      <td className="px-2 py-1.5 text-center">
                        <Checkbox
                          checked={item.owned}
                          onCheckedChange={(c) => updateOwned.mutate({ id: item.id, owned: !!c })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        {item.owned ? (
                          <span className="block text-right text-xs text-muted-foreground">—</span>
                        ) : (
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
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium">
                        {item.owned ? "—" : formatCurrency(item.quantity * unitPrice, referenceCurrency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/40 font-semibold">
                  <td className="px-3 py-2" colSpan={4}>
                    Total général (hors articles déjà possédés)
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

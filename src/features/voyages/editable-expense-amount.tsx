import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useCreateExpense, useUpdateExpense } from "@/features/voyages/use-expenses";
import { cn } from "@/lib/utils";
import type { ExpenseCategory, VoyageExpense } from "@/types/database";

/**
 * Case éditable liée à UNE dépense réelle (`voyage_expenses`), pas à un calcul parallèle.
 * Tant qu'aucune valeur n'a été saisie à la main (`is_estimated` reste vrai), le montant se
 * resynchronise automatiquement à chaque nouvelle estimation (ex. changement du nombre de
 * nuits) — c'est ce qui permet à un ajustement en amont (dates, distance...) de se répercuter
 * sans action de l'utilisateur. Dès qu'il tape une valeur lui-même, `is_estimated` passe à faux
 * et la ligne reste figée sur sa saisie, même si l'estimation évolue ensuite.
 *
 * Pour un montant qui ne doit JAMAIS être saisissable (ex. logement/nourriture, calculés depuis
 * un taux journalier), ne pas utiliser ce composant : voir `ComputedCostAmount` ci-dessous, qui
 * n'écrit rien en base et ne peut donc jamais être périmé.
 */
export function EditableExpenseAmount({
  scope,
  category,
  subCategory = null,
  planned,
  existing,
  estimate = null,
  referenceCurrency,
  invalidateKey,
  className,
  /** Vrai une fois que la requête d'où vient `existing` a fini de charger AU MOINS une fois.
   * Indispensable : tant que la requête est encore en cours (donc `existing` vaut `undefined`
   * parce qu'on n'a pas encore la réponse, pas parce que la ligne n'existe vraiment pas), il ne
   * faut surtout pas créer de nouvelle ligne — sinon une ligne en double se crée à chaque montage
   * du composant pendant que les données chargent (observé : le nombre de lignes en double
   * augmentait à chaque visite de l'onglet). Par défaut à `true` pour les appelants qui n'ont pas
   * cette notion de chargement (formulaires de saisie manuelle sans auto-création). */
  dataReady = true,
}: {
  scope: { voyageId?: string; sousEtapeId?: string; etapeId?: string };
  category: ExpenseCategory;
  subCategory?: string | null;
  planned: boolean;
  existing: VoyageExpense | undefined;
  /** Montant auto-estimé, resynchronisé tant que la ligne n'a pas été modifiée à la main ; null = pas d'estimation (saisie manuelle seule). */
  estimate?: number | null;
  referenceCurrency: string;
  invalidateKey: unknown[];
  className?: string;
  dataReady?: boolean;
}) {
  const createExpense = useCreateExpense(scope, invalidateKey);
  const updateExpense = useUpdateExpense(invalidateKey);
  const creatingRef = useRef(false);
  const [value, setValue] = useState(existing?.amount?.toString() ?? "");

  useEffect(() => {
    setValue(existing?.amount?.toString() ?? "");
  }, [existing?.amount]);

  useEffect(() => {
    if (!dataReady || estimate == null) return;
    if (!existing) {
      if (creatingRef.current || estimate < 0) return;
      creatingRef.current = true;
      createExpense.mutate(
        {
          category,
          sub_category: subCategory,
          planned,
          amount: Math.round(estimate * 100) / 100,
          currency: referenceCurrency,
          manual_rate_to_reference: 1,
          is_estimated: true,
        },
        // Si la création échoue (RLS, réseau...), on doit pouvoir réessayer au prochain rendu —
        // sinon le champ reste bloqué indéfiniment (creatingRef jamais réarmé) et semble ne plus
        // jamais s'enregistrer, sans aucune indication visible du problème.
        { onError: () => { creatingRef.current = false; } }
      );
      return;
    }
    if (existing.is_estimated) {
      if (Math.abs(existing.amount - estimate) > 0.01) {
        updateExpense.mutate({ id: existing.id, amount: Math.round(estimate * 100) / 100 });
      }
      // Le montant n'est pas la seule chose à resynchroniser : si le sous-type dont dépend
      // l'estimation a changé (ex. mode de transport ajusté après coup), la ligne stockée doit
      // suivre elle aussi — sinon elle reste rattachée à l'ancien sous-type indéfiniment (montant
      // à jour, mais classé dans le mauvais type dans le détail par catégorie).
      if (subCategory != null && existing.sub_category !== subCategory) {
        updateExpense.mutate({ id: existing.id, sub_category: subCategory });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing, estimate, subCategory, dataReady]);

  function handleBlur() {
    const amount = value.trim() === "" ? 0 : Math.max(0, Number(value));
    if (existing) {
      // Ne fige la ligne (is_estimated -> false) que si la valeur a réellement changé : un
      // simple focus/blur sans saisie (ex. tabulation dans le tableau) ne doit pas figer un
      // montant encore auto-estimé, sinon il ne se resynchroniserait plus jamais tout seul.
      if (amount !== existing.amount) {
        updateExpense.mutate({ id: existing.id, amount, is_estimated: false });
      }
    } else if (amount > 0 && !creatingRef.current) {
      creatingRef.current = true;
      createExpense.mutate(
        {
          category,
          sub_category: subCategory,
          planned,
          amount,
          currency: referenceCurrency,
          manual_rate_to_reference: 1,
          is_estimated: false,
        },
        { onError: () => { creatingRef.current = false; } }
      );
    }
  }

  return (
    <Input
      type="number"
      step="0.01"
      min="0"
      value={value}
      placeholder={estimate != null && estimate > 0 ? Math.round(estimate).toString() : "0"}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      className={className}
    />
  );
}

/**
 * Montant purement calculé (taux journalier x nuits, forfait...) : aucune ligne
 * `voyage_expenses` associée, donc rien à synchroniser et rien qui puisse être périmé — la
 * valeur affichée est TOUJOURS le calcul du moment. À utiliser pour tout coût prévisionnel que
 * l'utilisateur n'ajuste qu'indirectement (via le taux journalier ou le nombre de nuits), jamais
 * en tapant directement dedans.
 */
export function ComputedCostAmount({ amount, className }: { amount: number; className?: string }) {
  return (
    <Input
      type="text"
      readOnly
      disabled
      value={(Math.round(amount * 100) / 100).toString()}
      title="Calculé automatiquement (taux journalier x nombre de nuits) — ajuste le taux ou les nuits pour le changer"
      className={cn(className, "cursor-default disabled:opacity-100 bg-muted/40 text-muted-foreground")}
    />
  );
}

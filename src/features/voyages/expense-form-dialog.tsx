import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExpenseFormFields } from "@/features/voyages/expense-form-fields";
import type { ExpenseCategory, VoyageExpense } from "@/types/database";
import { Plus } from "lucide-react";

/**
 * Dialogue de dépense — à utiliser uniquement quand il n'est PAS imbriqué dans un autre
 * Dialog (ex. onglet Budget). Dans un contexte imbriqué (ex. dialogue d'une ville), utiliser
 * `ExpenseFormFields` directement en ligne pour éviter un Dialog dans un Dialog.
 */
export function ExpenseFormDialog({
  scope = {},
  categories,
  referenceCurrency,
  invalidateKey,
  projectId,
  existing,
  trigger,
  defaultPlanned = true,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  scope?: { voyageId?: string; sousEtapeId?: string };
  categories: { value: ExpenseCategory; label: string }[];
  referenceCurrency: string;
  invalidateKey: unknown[];
  projectId?: string;
  existing?: VoyageExpense;
  trigger?: ReactNode | null;
  defaultPlanned?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" /> Dépense
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
        </DialogHeader>
        <ExpenseFormFields
          scope={scope}
          categories={categories}
          referenceCurrency={referenceCurrency}
          invalidateKey={invalidateKey}
          projectId={projectId}
          existing={existing}
          defaultPlanned={defaultPlanned}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

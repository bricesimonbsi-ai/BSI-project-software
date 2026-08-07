import { useState, useMemo, type ChangeEvent } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEtapes } from "@/features/voyages/use-etapes";
import { useVoyageSousEtapes } from "@/features/voyages/use-sous-etapes";
import { useVoyage, useUpdateVoyage } from "@/features/voyages/use-voyages";
import { useVoyageAllExpenses } from "@/features/voyages/use-expenses";
import { buildFlatRows } from "@/features/voyages/itinerary/itinerary-model";
import { parseDelimitedText, parseAmount, parseDateFlexible } from "@/features/voyages/csv-import/csv-parse";
import {
  guessCategory,
  isWithdrawal,
  guessCity,
  splitCashWithdrawal,
  type CashSplitRatios,
} from "@/features/voyages/csv-import/import-matching";
import { useImportExpenses, type ImportExpenseInput } from "@/features/voyages/csv-import/use-expense-import";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Upload, TriangleAlert } from "lucide-react";
import type { ExpenseCategory, VoyageSousEtape } from "@/types/database";

const CARD_CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: "logement", label: "Logement" },
  { value: "transport", label: "Transport" },
  { value: "nourriture", label: "Nourriture" },
  { value: "activites", label: "Activités" },
  { value: "non_categorise", label: "Non catégorisée (à faire plus tard)" },
];

const NONE = "__none__";

/** Minuscules et sans accents, pour comparer des en-têtes de colonnes quel que soit l'encodage
 * ou l'orthographe exacte ("Débit"/"debit"/"DÉBIT (-)" doivent tous matcher "debit"). */
function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const HEADER_KEYWORDS = ["date", "montant", "debit", "credit", "libelle", "description", "solde"];

function guessHeaderRowIndex(grid: string[][]): number {
  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const row = grid[i];
    if (row.length >= 3 && row.some((c) => HEADER_KEYWORDS.some((k) => normalizeHeader(c).includes(k)))) return i;
  }
  return 0;
}

/** Première colonne dont l'en-tête contient un des mots-clés (et aucun des mots-clés à exclure) —
 * "solde" est systématiquement exclu des colonnes montant/débit/crédit pour ne jamais confondre
 * un solde cumulé avec le montant d'une transaction (cause du bug de montants signalé : une
 * colonne "Solde" avait été choisie à la place de "Débit"). */
function guessColumnIndex(headers: string[], includeAny: string[], excludeAny: string[] = ["solde"]): number | null {
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeHeader(headers[i]);
    if (excludeAny.some((k) => h.includes(k))) continue;
    if (includeAny.some((k) => h.includes(k))) return i;
  }
  return null;
}

/** Signature de doublon "même date, même montant" (voir la demande de détection) — volontairement
 * sans la ville ni la catégorie, pour rattraper une dépense réimportée même si sa ville a été
 * réaffectée différemment entre les deux imports. Pour un retrait, la signature se calcule sur
 * CHAQUE part ventilée (ce qui est réellement enregistré en base), jamais sur le montant brut du
 * retrait, qui lui n'est jamais stocké. */
function signature(date: string | null, amount: number): string {
  return `${date ?? "?"}|${amount.toFixed(2)}`;
}

function rowSignatures(r: ParsedRow, cashRatios: CashSplitRatios): string[] {
  if (r.isWithdrawal) return splitCashWithdrawal(r.amount, cashRatios).map((item) => signature(r.date, item.amount));
  return [signature(r.date, r.amount)];
}

type Step = "file" | "header" | "mapping" | "preview";

type ParsedRow = {
  id: string;
  date: string | null;
  description: string;
  amount: number;
  isWithdrawal: boolean;
  /** Toujours renseignée (jamais bloquante à l'import) : "non_categorise" quand aucun mot-clé du
   * libellé n'a permis de deviner — corrigeable ensuite depuis l'onglet "Gérer mes dépenses". */
  category: ExpenseCategory;
  sousEtapeId: string;
  include: boolean;
};

/**
 * Import d'un relevé bancaire (CSV) en dépenses réelles : le fichier n'est JAMAIS envoyé nulle
 * part (lecture locale via FileReader, analyse entièrement côté client) et n'est conservé sous
 * aucune forme une fois l'import confirmé — seules les dépenses résolues (montant/date/
 * catégorie/ville) sont enregistrées, jamais le contenu brut du relevé. Générique par
 * conception : le mapping des colonnes est fait à la main à chaque import (aucun format de
 * banque particulier n'est supposé), pour rester valable même en cas de changement de banque.
 */
export function ExpenseImportDialog({
  voyageId,
  projectId,
  referenceCurrency,
}: {
  voyageId: string;
  projectId: string;
  referenceCurrency: string;
}) {
  const { data: voyage } = useVoyage(projectId);
  const { data: etapes } = useEtapes(voyageId);
  const { data: allSousEtapes } = useVoyageSousEtapes(voyageId);
  const { data: existingExpenses } = useVoyageAllExpenses(voyageId);
  const updateVoyage = useUpdateVoyage(projectId);
  const importExpenses = useImportExpenses(voyageId, referenceCurrency);

  // Dépenses réelles déjà en base (n'importe quelle source : saisie manuelle ou import
  // précédent) — sert à repérer un probable doublon (même date/montant) si l'utilisateur
  // réimporte un relevé dont la période chevauche un import déjà fait.
  const existingSignatures = useMemo(
    () =>
      new Set(
        (existingExpenses ?? []).filter((e) => !e.planned).map((e) => signature(e.expense_date, e.amount * e.manual_rate_to_reference))
      ),
    [existingExpenses]
  );

  const citiesByEtape = new Map<string, VoyageSousEtape[]>();
  for (const se of allSousEtapes ?? []) {
    const list = citiesByEtape.get(se.etape_id) ?? [];
    list.push(se);
    citiesByEtape.set(se.etape_id, list);
  }
  const flat = buildFlatRows(etapes ?? [], citiesByEtape);
  const cityOptions = flat.map((r) => ({ id: r.sousEtape.id, label: `${r.etape.country_region} · ${r.sousEtape.city}` }));

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("file");
  const [rawGrid, setRawGrid] = useState<string[][]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [referenceYear, setReferenceYear] = useState(new Date().getFullYear());
  const [amountMode, setAmountMode] = useState<"single" | "split">("split");
  const [dateColIdx, setDateColIdx] = useState<string>(NONE);
  const [descColIdx, setDescColIdx] = useState<string>(NONE);
  const [amountColIdx, setAmountColIdx] = useState<string>(NONE);
  const [debitColIdx, setDebitColIdx] = useState<string>(NONE);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [cashRatios, setCashRatios] = useState<CashSplitRatios>({ transport_local: 15, activites: 40, nourriture: 45 });
  const [savingRatios, setSavingRatios] = useState(false);

  function resetAll() {
    setStep("file");
    setRawGrid([]);
    setHeaderRowIndex(0);
    setDateColIdx(NONE);
    setDescColIdx(NONE);
    setAmountColIdx(NONE);
    setDebitColIdx(NONE);
    setRows([]);
  }

  function handleOpenChange(o: boolean) {
    setOpen(o);
    if (!o) resetAll();
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const grid = parseDelimitedText(text);
      if (grid.length === 0) {
        toast({ title: "Fichier vide ou illisible", variant: "destructive" });
        return;
      }
      setRawGrid(grid);
      setHeaderRowIndex(guessHeaderRowIndex(grid));
      if (voyage?.start_date) setReferenceYear(new Date(voyage.start_date).getFullYear());
      setCashRatios(voyage?.cash_split_ratios ?? { transport_local: 15, activites: 40, nourriture: 45 });
      setStep("header");
    };
    reader.readAsText(file, "utf-8");
  }

  // Pré-remplit le mapping à partir du texte des en-têtes (ex. "Débit (-)" -> colonne débit),
  // "solde" étant systématiquement exclu des candidats montant/débit/crédit — l'utilisateur reste
  // libre de corriger via les listes déroulantes, mais part d'un mapping déjà correct dans le cas
  // courant plutôt que de devoir deviner lui-même (source du bug Solde/Débit signalé).
  function goToMapping() {
    const headers = rawGrid[headerRowIndex] ?? [];
    const dateIdx = guessColumnIndex(headers, ["operation"]) ?? guessColumnIndex(headers, ["date"]);
    const descIdx = guessColumnIndex(headers, ["libelle", "description", "objet", "detail"]);
    const debitIdx = guessColumnIndex(headers, ["debit"]);
    const montantIdx = guessColumnIndex(headers, ["montant"]);

    setDateColIdx(dateIdx != null ? String(dateIdx) : NONE);
    setDescColIdx(descIdx != null ? String(descIdx) : NONE);
    if (debitIdx != null) {
      setAmountMode("split");
      setDebitColIdx(String(debitIdx));
      setAmountColIdx(NONE);
    } else if (montantIdx != null) {
      setAmountMode("single");
      setAmountColIdx(String(montantIdx));
      setDebitColIdx(NONE);
    } else {
      setDebitColIdx(NONE);
      setAmountColIdx(NONE);
    }
    setStep("mapping");
  }

  function buildPreviewRows() {
    const dateCol = Number(dateColIdx);
    const descCol = Number(descColIdx);
    const amountCol = amountMode === "single" ? Number(amountColIdx) : Number(debitColIdx);
    if (dateColIdx === NONE || descColIdx === NONE || (amountMode === "single" ? amountColIdx === NONE : debitColIdx === NONE)) {
      toast({ title: "Sélectionne toutes les colonnes requises", variant: "destructive" });
      return;
    }

    const dataRows = rawGrid.slice(headerRowIndex + 1);
    const parsed: ParsedRow[] = [];
    for (const raw of dataRows) {
      const amountRaw = raw[amountCol] ?? "";
      if (!amountRaw.trim()) continue; // colonne débit vide = ligne de crédit (rentrée d'argent), ignorée
      const amount = parseAmount(amountRaw);
      if (amount == null || amount === 0) continue;

      const date = parseDateFlexible(raw[dateCol] ?? "", referenceYear);
      const description = (raw[descCol] ?? "").split("\n")[0].trim();
      const withdrawal = isWithdrawal(description);
      const guessed = withdrawal ? null : guessCategory(description);
      const sousEtape = date ? guessCity(flat, date, guessed) : null;

      parsed.push({
        id: `${parsed.length}-${date ?? "x"}-${amount}`,
        date,
        description: description || "(sans libellé)",
        amount: Math.abs(amount),
        isWithdrawal: withdrawal,
        category: withdrawal ? "non_categorise" : (guessed ?? "non_categorise"),
        sousEtapeId: sousEtape?.id ?? NONE,
        include: true,
      });
    }
    if (parsed.length === 0) {
      toast({ title: "Aucune dépense reconnue avec ce mapping", variant: "destructive" });
      return;
    }

    // Décoché par défaut si ça ressemble à un doublon (déjà en base, ou répété dans ce même
    // fichier) — l'utilisateur reste libre de recocher s'il sait que c'est légitime (voir le
    // badge d'avertissement dans l'aperçu, qui reste affiché même après recochage).
    const batchCounts = new Map<string, number>();
    for (const r of parsed) for (const s of rowSignatures(r, cashRatios)) batchCounts.set(s, (batchCounts.get(s) ?? 0) + 1);
    for (const r of parsed) {
      const looksDuplicate = rowSignatures(r, cashRatios).some((s) => existingSignatures.has(s) || (batchCounts.get(s) ?? 0) > 1);
      if (looksDuplicate) r.include = false;
    }

    setRows(parsed);
    setStep("preview");
  }

  function updateRow(id: string, patch: Partial<ParsedRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function handleSaveRatios() {
    setSavingRatios(true);
    await updateVoyage.mutateAsync({ cash_split_ratios: cashRatios });
    setSavingRatios(false);
  }

  function handleConfirm() {
    const included = rows.filter((r) => r.include);
    const inputs: ImportExpenseInput[] = [];
    for (const r of included) {
      const sousEtapeId = r.sousEtapeId === NONE ? null : r.sousEtapeId;
      if (r.isWithdrawal) {
        // Chaque part garde le libellé d'origine du retrait + une mention explicite de sa part
        // et du montant total retiré, pour rester compréhensible une fois affichée seule dans
        // "Gérer mes dépenses" (3 lignes distinctes, pas un seul bloc groupé) — sans ça, 3 lignes
        // identiques avec des montants différents semblent 3 dépenses sans rapport entre elles.
        for (const item of splitCashWithdrawal(r.amount, cashRatios)) {
          if (item.amount <= 0) continue;
          inputs.push({
            sous_etape_id: sousEtapeId,
            category: item.category,
            sub_category: item.subCategory ?? null,
            amount: item.amount,
            expense_date: r.date,
            description: `${r.description} — part ${item.label} (retrait de ${formatCurrency(r.amount, referenceCurrency)})`,
            source: "retrait",
          });
        }
      } else {
        inputs.push({
          sous_etape_id: sousEtapeId,
          category: r.category,
          amount: r.amount,
          expense_date: r.date,
          description: r.description,
          source: "carte",
        });
      }
    }
    importExpenses.mutate(inputs, {
      onSuccess: () => {
        toast({ title: `${included.length} dépense(s) importée(s)`, description: "Marquées « à valider » dans le tableau." });
        handleOpenChange(false);
      },
    });
  }

  const mappingSampleRows = rawGrid.slice(headerRowIndex + 1, headerRowIndex + 4);
  const hasWithdrawalRows = rows.some((r) => r.isWithdrawal);
  const includedCount = rows.filter((r) => r.include).length;
  const allIncluded = rows.length > 0 && includedCount === rows.length;
  const someIncluded = includedCount > 0;

  // Recalculé à chaque modification (ville/montant peuvent changer dans l'aperçu) : purement
  // indicatif, contrairement au décochage par défaut ci-dessus qui n'a lieu qu'une fois.
  const duplicateIds = useMemo(() => {
    const batchCounts = new Map<string, number>();
    for (const r of rows) for (const s of rowSignatures(r, cashRatios)) batchCounts.set(s, (batchCounts.get(s) ?? 0) + 1);
    const ids = new Set<string>();
    for (const r of rows) {
      if (rowSignatures(r, cashRatios).some((s) => existingSignatures.has(s) || (batchCounts.get(s) ?? 0) > 1)) ids.add(r.id);
    }
    return ids;
  }, [rows, cashRatios, existingSignatures]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="mr-1.5 h-3.5 w-3.5" />
        Importer un relevé (CSV)
      </Button>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importer des dépenses depuis un CSV</DialogTitle>
        </DialogHeader>

        {step === "file" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Choisis l'export CSV de ton relevé bancaire. Le fichier est lu uniquement dans ton navigateur : rien n'est envoyé ni conservé, seules
              les dépenses que tu valides ensuite sont enregistrées.
            </p>
            <Input type="file" accept=".csv,.txt,text/csv" onChange={handleFile} />
          </div>
        )}

        {step === "header" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Beaucoup de relevés commencent par quelques lignes d'informations (IBAN, période...) avant le vrai tableau. Sélectionne la ligne
              d'en-tête (celle avec "Date", "Montant"...) — tout ce qui est au-dessus sera ignoré.
            </p>
            <div className="max-h-64 overflow-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <tbody>
                  {rawGrid.slice(0, 15).map((row, i) => (
                    <tr
                      key={i}
                      className={cn("cursor-pointer border-b border-border last:border-0", headerRowIndex === i && "bg-accent/60")}
                      onClick={() => setHeaderRowIndex(i)}
                    >
                      <td className="px-2 py-1">
                        <input type="radio" checked={headerRowIndex === i} onChange={() => setHeaderRowIndex(i)} />
                      </td>
                      {row.slice(0, 6).map((cell, j) => (
                        <td key={j} className="max-w-[10rem] truncate px-2 py-1">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="max-w-[12rem] space-y-1">
              <Label className="text-xs">Année de référence (si les dates n'indiquent pas l'année)</Label>
              <Input type="number" value={referenceYear} onChange={(e) => setReferenceYear(Number(e.target.value))} />
            </div>
            <Button type="button" onClick={goToMapping}>
              Continuer
            </Button>
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Colonne date</Label>
                <ColumnSelect value={dateColIdx} onChange={setDateColIdx} columns={rawGrid[headerRowIndex]} sampleRows={mappingSampleRows} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Colonne libellé / description</Label>
                <ColumnSelect value={descColIdx} onChange={setDescColIdx} columns={rawGrid[headerRowIndex]} sampleRows={mappingSampleRows} />
              </div>
            </div>

            <div className="inline-flex rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => setAmountMode("split")}
                className={cn("rounded px-3 py-1 text-xs font-medium", amountMode === "split" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
              >
                Débit / Crédit séparés
              </button>
              <button
                type="button"
                onClick={() => setAmountMode("single")}
                className={cn("rounded px-3 py-1 text-xs font-medium", amountMode === "single" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
              >
                Montant en une seule colonne
              </button>
            </div>

            {amountMode === "split" ? (
              <div className="max-w-xs space-y-1">
                <Label className="text-xs">Colonne débit (dépenses)</Label>
                <ColumnSelect value={debitColIdx} onChange={setDebitColIdx} columns={rawGrid[headerRowIndex]} sampleRows={mappingSampleRows} />
                <p className="text-xs text-muted-foreground">
                  Les lignes sans valeur dans cette colonne (rentrées d'argent) sont ignorées. Attention à ne pas choisir la colonne "Solde"
                  (regarde les exemples affichés).
                </p>
              </div>
            ) : (
              <div className="max-w-xs space-y-1">
                <Label className="text-xs">Colonne montant</Label>
                <ColumnSelect value={amountColIdx} onChange={setAmountColIdx} columns={rawGrid[headerRowIndex]} sampleRows={mappingSampleRows} />
                <p className="text-xs text-muted-foreground">Suppose que toutes les lignes du fichier sont des dépenses.</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("header")}>
                Retour
              </Button>
              <Button type="button" onClick={buildPreviewRows}>
                Aperçu
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {hasWithdrawalRows && (
              <div className="space-y-2 rounded-md border border-border/70 p-2.5">
                <p className="text-sm font-semibold">Répartition automatique des retraits d'espèces</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Transport sur place %</Label>
                    <Input
                      type="number"
                      value={cashRatios.transport_local}
                      onChange={(e) => setCashRatios((r) => ({ ...r, transport_local: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Activités %</Label>
                    <Input type="number" value={cashRatios.activites} onChange={(e) => setCashRatios((r) => ({ ...r, activites: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nourriture %</Label>
                    <Input
                      type="number"
                      value={cashRatios.nourriture}
                      onChange={(e) => setCashRatios((r) => ({ ...r, nourriture: Number(e.target.value) }))}
                    />
                  </div>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={handleSaveRatios} disabled={savingRatios}>
                  Mémoriser cette répartition pour les prochains imports
                </Button>
              </div>
            )}

            {duplicateIds.size > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                {duplicateIds.size} ligne{duplicateIds.size > 1 ? "s" : ""} ressemble{duplicateIds.size > 1 ? "nt" : ""} à une dépense déjà
                existante (même date, même montant) — décochée{duplicateIds.size > 1 ? "s" : ""} par défaut, à recocher si c'est volontaire.
              </p>
            )}

            <div className="max-h-[24rem] overflow-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-2 py-1.5">
                      <Checkbox
                        checked={allIncluded ? true : someIncluded ? "indeterminate" : false}
                        onCheckedChange={(c) => setRows((prev) => prev.map((r) => ({ ...r, include: c !== false })))}
                        title={allIncluded ? "Tout désélectionner" : "Tout sélectionner"}
                      />
                    </th>
                    <th className="px-2 py-1.5">Date</th>
                    <th className="px-2 py-1.5">Description</th>
                    <th className="px-2 py-1.5 text-right">Montant</th>
                    <th className="px-2 py-1.5">Catégorie</th>
                    <th className="px-2 py-1.5">Ville</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={cn("border-b border-border last:border-0", !r.include && "opacity-40")}>
                      <td className="px-2 py-1.5">
                        <Checkbox checked={r.include} onCheckedChange={(c) => updateRow(r.id, { include: c === true })} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5">{r.date ?? <span className="text-destructive">non reconnue</span>}</td>
                      <td className="max-w-[14rem] truncate px-2 py-1.5" title={r.description}>
                        {duplicateIds.has(r.id) && (
                          <TriangleAlert
                            className="mr-1 inline h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
                            aria-label="Doublon probable"
                          />
                        )}
                        {r.isWithdrawal ? "💵 " : "💳 "}
                        {r.description}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium">{formatCurrency(r.amount, referenceCurrency)}</td>
                      <td className="px-2 py-1.5">
                        {r.isWithdrawal ? (
                          <span className="text-muted-foreground">
                            Ventilé auto ({cashRatios.transport_local}/{cashRatios.activites}/{cashRatios.nourriture})
                          </span>
                        ) : (
                          <Select value={r.category} onValueChange={(v) => updateRow(r.id, { category: v as ExpenseCategory })}>
                            <SelectTrigger className="h-8 w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CARD_CATEGORY_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={r.sousEtapeId} onValueChange={(v) => updateRow(r.id, { sousEtapeId: v })}>
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue placeholder="Non affectée" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Non affectée</SelectItem>
                            {cityOptions.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{includedCount} dépense(s) seront importées, marquées « à valider ».</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep("mapping")}>
                  Retour
                </Button>
                <Button type="button" onClick={handleConfirm} disabled={importExpenses.isPending || includedCount === 0}>
                  Importer
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** `sampleRows` (quelques lignes de données brutes) permet d'afficher un aperçu des valeurs
 * réelles de la colonne choisie — sans ça, une colonne "Solde" (à ne surtout pas confondre avec
 * "Débit") reste indiscernable d'une colonne de montants tant qu'on n'a pas terminé tout
 * l'import : les deux sont des nombres avec virgule/point, seul le contenu les distingue. */
function ColumnSelect({
  value,
  onChange,
  columns,
  sampleRows,
}: {
  value: string;
  onChange: (v: string) => void;
  columns: string[] | undefined;
  sampleRows: string[][];
}) {
  const idx = Number(value);
  const samples =
    value !== NONE && !Number.isNaN(idx)
      ? sampleRows.map((r) => r[idx]).filter((v): v is string => v != null && v.trim() !== "").slice(0, 3)
      : [];
  return (
    <div className="space-y-1">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Choisir une colonne" />
        </SelectTrigger>
        <SelectContent>
          {(columns ?? []).map((label, i) => (
            <SelectItem key={i} value={String(i)}>
              {label || `Colonne ${i + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {samples.length > 0 && <p className="text-xs text-muted-foreground">Exemples : {samples.join(" · ")}</p>}
    </div>
  );
}

/**
 * Parseur CSV volontairement générique (pas calé sur le format d'une banque en particulier,
 * l'utilisateur pouvant en changer) : délimiteur (`,` ou `;`) auto-détecté, champs entre
 * guillemets pouvant contenir des retours à la ligne et des guillemets échappés (`""`) — un
 * relevé bancaire réel a souvent une description multi-lignes (références internes/externes sur
 * plusieurs lignes dans le même champ), qu'un simple split ligne par ligne casserait.
 */

function detectDelimiter(firstLine: string): "," | ";" {
  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ",") commas++;
    else if (!inQuotes && ch === ";") semicolons++;
  }
  return semicolons > commas ? ";" : ",";
}

/** Retourne la grille brute (une ligne = un tableau de cellules texte), lignes entièrement
 * vides écartées. Ne suppose rien sur la présence/position d'un en-tête : voir
 * expense-import-dialog.tsx, qui laisse l'utilisateur désigner la ligne d'en-tête, un relevé
 * bancaire commençant souvent par plusieurs lignes de métadonnées (IBAN, période, soldes...). */
export function parseDelimitedText(text: string): string[][] {
  const firstLineEnd = text.indexOf("\n");
  const firstLine = firstLineEnd === -1 ? text : text.slice(0, firstLineEnd);
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let touched = false;

  function pushField() {
    row.push(field);
    field = "";
  }
  function pushRow() {
    pushField();
    rows.push(row);
    row = [];
    touched = false;
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      touched = true;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      touched = true;
    } else if (ch === delimiter) {
      pushField();
      touched = true;
    } else if (ch === "\r") {
      continue;
    } else if (ch === "\n") {
      pushRow();
    } else {
      field += ch;
      touched = true;
    }
  }
  if (touched || field !== "") pushRow();

  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Montant tolérant à la virgule OU au point décimal (et aux séparateurs de milliers courants,
 * espace/point/virgule selon le cas), signe optionnel ou parenthèses = négatif. Toujours
 * relu dans l'aperçu avant import : une erreur de parsing reste visible et corrigeable. */
export function parseAmount(raw: string): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (s === "") return null;
  const negative = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[€$£\s ()+-]/g, "");
  if (s === "") return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 2 ? s.replace(",", ".") : s.replace(/,/g, "");
  }

  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return negative ? -Math.abs(value) : value;
}

/** Date tolérante à AAAA-MM-JJ, JJ/MM/AAAA (ou "-"/"." comme séparateur) et JJ/MM sans année
 * (certains relevés n'indiquent que le jour/mois, l'année se déduisant de la période du
 * relevé) — dans ce dernier cas, `fallbackYear` comble l'année manquante. Retourne un ISO
 * "AAAA-MM-JJ" ou null si le format n'est pas reconnu. */
export function parseDateFlexible(raw: string, fallbackYear: number): string | null {
  if (!raw) return null;
  const s = raw.trim();

  let m = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})$/);
  if (m) return `${fallbackYear}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;

  return null;
}

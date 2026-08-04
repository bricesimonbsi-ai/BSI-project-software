import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/features/voyages/currency-data";

/** Liste déroulante de devises (symbole + code + nom), données embarquées — aucun appel réseau. */
export function CurrencySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Devise" />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c.code} value={c.code}>
            {c.symbol} {c.code} — {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

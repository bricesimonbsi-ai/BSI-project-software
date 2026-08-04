import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { COUNTRIES } from "@/features/voyages/itinerary/countries-data";
import { cn } from "@/lib/utils";

type PickerProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (name: string, lat: number, lng: number) => void;
  placeholder?: string;
};

/** Retrouve un pays de la référence statique par son nom (recherche exacte insensible à la casse). */
export function findCountryByName(name: string) {
  const q = name.trim().toLowerCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === q);
}

/** Emoji drapeau du pays s'il est reconnu dans la référence statique, sinon null. */
export function getCountryFlag(name: string): string | null {
  return findCountryByName(name)?.flag ?? null;
}

/** Code ISO 3166-1 alpha-2 du pays s'il est reconnu, sinon null (pour l'image de drapeau réelle). */
export function getCountryCca2(name: string): string | null {
  return findCountryByName(name)?.cca2 ?? null;
}

/**
 * Vrai drapeau (image SVG via le package flag-icons, embarqué au build, aucun appel réseau),
 * fiable sur toutes les plateformes contrairement à l'emoji (rendu en deux lettres sur Windows).
 */
export function CountryFlag({ name, className }: { name: string; className?: string }) {
  const cca2 = getCountryCca2(name);
  if (!cca2) return null;
  return <span className={cn("fi", `fi-${cca2.toLowerCase()}`, className)} title={name} />;
}

/** Champ pays avec suggestions filtrées localement (données embarquées, aucun appel réseau) + drapeau + GPS auto. */
export function CountryPicker({ value, onChange, onSelect, placeholder }: PickerProps) {
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q)) : COUNTRIES;
    return list.slice(0, 8);
  }, [value]);

  return (
    <div className="relative">
      <Input
        required
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? "Nom du pays..."}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
          {filtered.map((c) => (
            <button
              key={c.cca2}
              type="button"
              className="flex w-full items-center gap-2 truncate px-3 py-1.5 text-left text-sm hover:bg-secondary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(c.name, c.lat, c.lng);
                setOpen(false);
              }}
            >
              <span className={cn("fi", `fi-${c.cca2.toLowerCase()}`)} />
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type NominatimResult = { display_name: string; lat: string; lon: string };

/** Champ ville avec recherche via l'API de géocodage Nominatim (OpenStreetMap), gratuite et sans clé.
 * Si `countryCode` est fourni, la recherche est restreinte à ce pays. */
export function CityPicker({
  value,
  onChange,
  onSelect,
  placeholder,
  countryCode,
}: PickerProps & { countryCode?: string | null }) {
  const [results, setResults] = useState<{ label: string; lat: number; lon: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (value.trim().length < 3) {
      setResults([]);
      setErrored(false);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setErrored(false);
      try {
        const params = new URLSearchParams({ format: "json", limit: "8", q: value });
        if (countryCode) params.set("countrycodes", countryCode.toLowerCase());
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Nominatim indisponible");
        const data = (await res.json()) as NominatimResult[];
        setResults(data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lon: Number(d.lon) })));
      } catch (err) {
        if ((err as Error).name !== "AbortError") setErrored(true);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [value, countryCode]);

  return (
    <div className="relative">
      <Input
        required
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? "Nom de la ville..."}
        autoComplete="off"
      />
      {open && (loading || errored || results.length > 0) && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Recherche...</div>}
          {!loading && errored && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Service de recherche indisponible — saisie manuelle possible.
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-secondary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(r.label.split(",")[0], r.lat, r.lon);
                setOpen(false);
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

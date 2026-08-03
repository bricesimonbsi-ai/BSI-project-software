import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";

type PickerProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (name: string, lat: number, lng: number) => void;
  placeholder?: string;
};

/** Liste des pays (nom + coordonnées GPS du centroïde) via l'API gratuite restcountries.com, mise en cache. */
function useCountriesReference() {
  return useQuery({
    queryKey: ["countries-reference"],
    staleTime: Infinity,
    queryFn: async (): Promise<{ name: string; lat: number; lng: number }[]> => {
      const res = await fetch("https://restcountries.com/v3.1/all?fields=name,latlng");
      if (!res.ok) throw new Error("restcountries.com indisponible");
      const data = (await res.json()) as Array<{ name?: { common?: string }; latlng?: number[] }>;
      return data
        .filter((c): c is { name: { common: string }; latlng: number[] } => !!c.name?.common && Array.isArray(c.latlng) && c.latlng.length === 2)
        .map((c) => ({ name: c.name.common, lat: c.latlng[0], lng: c.latlng[1] }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    },
  });
}

/** Champ pays avec suggestions filtrées localement + remplissage auto des coordonnées GPS. */
export function CountryPicker({ value, onChange, onSelect, placeholder }: PickerProps) {
  const { data: countries } = useCountriesReference();
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!countries) return [];
    const q = value.trim().toLowerCase();
    const list = q ? countries.filter((c) => c.name.toLowerCase().includes(q)) : countries;
    return list.slice(0, 8);
  }, [countries, value]);

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
              key={c.name}
              type="button"
              className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-secondary"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(c.name, c.lat, c.lng);
                setOpen(false);
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type NominatimResult = { display_name: string; lat: string; lon: string };

/** Champ ville avec recherche via l'API de géocodage Nominatim (OpenStreetMap), gratuite et sans clé. */
export function CityPicker({ value, onChange, onSelect, placeholder }: PickerProps) {
  const [results, setResults] = useState<{ label: string; lat: number; lon: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value.trim().length < 3) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=8&q=${encodeURIComponent(value)}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = (await res.json()) as NominatimResult[];
        setResults(data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lon: Number(d.lon) })));
      } catch {
        // requête annulée ou réseau indisponible : la saisie manuelle reste possible.
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
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
        placeholder={placeholder ?? "Nom de la ville..."}
        autoComplete="off"
      />
      {open && (loading || results.length > 0) && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-card shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Recherche...</div>}
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

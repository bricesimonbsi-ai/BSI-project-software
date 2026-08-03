import { useMemo } from "react";
import type { CountryGroup } from "@/features/voyages/itinerary/itinerary-model";
import { estimateCo2Kg } from "@/features/voyages/itinerary/itinerary-model";
import { Card, CardContent } from "@/components/ui/card";

export function CarbonDashboard({ groups }: { groups: CountryGroup[] }) {
  const stats = useMemo(() => {
    let totalKm = 0;
    let totalCo2 = 0;
    const byMode: Record<string, number> = {};
    const byCountry: { name: string; co2: number }[] = [];
    let flightLegs = 0;
    let totalLegs = 0;

    for (const group of groups) {
      let countryCo2 = 0;
      for (const row of group.rows) {
        const km = row.incomingDistanceKm ?? 0;
        const mode = row.incomingMode;
        if (km > 0) {
          totalLegs += 1;
          const co2 = estimateCo2Kg(km, mode);
          totalKm += km;
          totalCo2 += co2;
          countryCo2 += co2;
          const modeKey = mode?.toLowerCase().includes("avion") || mode?.toLowerCase().includes("✈") ? "Avion" : mode || "Autre";
          byMode[modeKey] = (byMode[modeKey] ?? 0) + co2;
          if (modeKey === "Avion") flightLegs += 1;
        }
      }
      if (countryCo2 > 0) byCountry.push({ name: group.etape.country_region, co2: countryCo2 });
    }

    byCountry.sort((a, b) => b.co2 - a.co2);
    const modeEntries = Object.entries(byMode).sort((a, b) => b[1] - a[1]);
    const maxModeCo2 = modeEntries[0]?.[1] ?? 1;
    const maxCountryCo2 = byCountry[0]?.co2 ?? 1;

    return { totalKm, totalCo2, modeEntries, maxModeCo2, byCountry, maxCountryCo2, flightLegs, totalLegs };
  }, [groups]);

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-4xl font-bold">{stats.totalCo2.toLocaleString("fr-FR")}</span>
        <span className="text-lg font-semibold text-muted-foreground">kg CO₂e estimés</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Estimation simple (distance × facteur d'émission par mode de transport), sans appel à une API externe.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-lg font-bold">{Math.round(stats.totalKm).toLocaleString("fr-FR")} km</p>
            <p className="text-xs text-muted-foreground">Distance totale parcourue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-lg font-bold">
              {stats.totalKm > 0 ? Math.round((stats.totalCo2 / stats.totalKm) * 1000) : 0} kg
            </p>
            <p className="text-xs text-muted-foreground">CO₂ moyen / 1 000 km</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-lg font-bold">
              {stats.flightLegs} / {stats.totalLegs}
            </p>
            <p className="text-xs text-muted-foreground">Trajets en avion</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Répartition par mode de transport
        </h3>
        <div className="space-y-2">
          {stats.modeEntries.map(([mode, co2]) => (
            <div key={mode} className="flex items-center gap-3 text-sm">
              <span className="w-24 flex-shrink-0">{mode}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(co2 / stats.maxModeCo2) * 100}%` }} />
              </div>
              <span className="w-16 flex-shrink-0 text-right font-semibold">{co2.toLocaleString("fr-FR")} kg</span>
            </div>
          ))}
          {stats.modeEntries.length === 0 && <p className="text-sm text-muted-foreground">Pas encore de trajet renseigné.</p>}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Répartition par pays</h3>
        <div className="space-y-2">
          {stats.byCountry.map((c) => (
            <div key={c.name} className="flex items-center gap-3 text-sm">
              <span className="w-32 flex-shrink-0 truncate">{c.name}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(c.co2 / stats.maxCountryCo2) * 100}%` }} />
              </div>
              <span className="w-16 flex-shrink-0 text-right font-semibold">{c.co2.toLocaleString("fr-FR")} kg</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

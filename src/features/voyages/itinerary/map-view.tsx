import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CountryGroup } from "@/features/voyages/itinerary/itinerary-model";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function makePinIcon(label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:hsl(199 89% 48%);color:white;border-radius:9999px;width:1.75rem;height:1.75rem;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.7rem;box-shadow:0 1px 3px rgba(0,0,0,0.4)">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function MapView({ groups }: { groups: CountryGroup[] }) {
  const [level, setLevel] = useState<"pays" | "villes">("pays");

  const countryPoints = useMemo(
    () =>
      groups
        .filter((g) => g.etape.latitude != null && g.etape.longitude != null)
        .map((g) => ({
          lat: g.etape.latitude as number,
          lng: g.etape.longitude as number,
          label: g.stepRangeLabel,
          name: g.etape.country_region,
        })),
    [groups]
  );

  const cityPoints = useMemo(
    () =>
      groups.flatMap((g) =>
        g.rows
          .filter((r) => r.sousEtape.latitude != null && r.sousEtape.longitude != null)
          .map((r) => ({
            lat: r.sousEtape.latitude as number,
            lng: r.sousEtape.longitude as number,
            label: String(r.globalIndex),
            name: r.sousEtape.city,
          }))
      ),
    [groups]
  );

  const points = level === "pays" ? countryPoints : cityPoints;
  const center = points.length > 0 ? ([points[0].lat, points[0].lng] as [number, number]) : ([20, -60] as [number, number]);

  if (points.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        Ajoute des coordonnées GPS (latitude/longitude) sur tes étapes pour voir la carte.
      </div>
    );
  }

  return (
    <div className="relative h-[480px] overflow-hidden rounded-md border border-border">
      <div className="absolute right-3 top-3 z-[1000] flex gap-1 rounded-full border border-border bg-card/90 p-1 backdrop-blur">
        <Button
          size="sm"
          variant={level === "pays" ? "default" : "ghost"}
          className={cn("h-7 rounded-full px-3 text-xs")}
          onClick={() => setLevel("pays")}
        >
          Pays
        </Button>
        <Button
          size="sm"
          variant={level === "villes" ? "default" : "ghost"}
          className={cn("h-7 rounded-full px-3 text-xs")}
          onClick={() => setLevel("villes")}
        >
          Villes
        </Button>
      </div>
      <MapContainer center={center} zoom={2} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={points.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#0ea5e9", dashArray: "6 4" }} />
        {points.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]} icon={makePinIcon(p.label)}>
            <Tooltip>{p.name}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

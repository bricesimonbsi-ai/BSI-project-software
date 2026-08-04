import { Fragment, useMemo, useState } from "react";
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

function makePlaneIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="font-size:1.1rem;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5))">✈️</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/** Couleur de trajet par mode de transport (mêmes familles de couleur que le tableau). */
const MODE_LINE_COLOR: Record<string, string> = {
  avion: "#0284c7",
  train: "#7c3aed",
  bus: "#d97706",
  voiture: "#475569",
  ferry: "#0891b2",
};

function modeLineColor(mode: string | null): string {
  if (!mode) return "#94a3b8";
  const key = Object.keys(MODE_LINE_COLOR).find((k) => mode.toLowerCase().includes(k));
  return key ? MODE_LINE_COLOR[key] : "#94a3b8";
}

/** Points intermédiaires d'un arc (courbe de Bézier quadratique) pour distinguer visuellement
 * les trajets en avion des trajets terrestres tracés en ligne droite. */
function arcPoints(lat1: number, lng1: number, lat2: number, lng2: number, segments = 24): [number, number][] {
  const dx = lng2 - lng1;
  const dy = lat2 - lat1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
  const perpLat = -dx / dist;
  const perpLng = dy / dist;
  const bow = dist * 0.15;
  const controlLat = (lat1 + lat2) / 2 + perpLat * bow;
  const controlLng = (lng1 + lng2) / 2 + perpLng * bow;
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lat = (1 - t) ** 2 * lat1 + 2 * (1 - t) * t * controlLat + t ** 2 * lat2;
    const lng = (1 - t) ** 2 * lng1 + 2 * (1 - t) * t * controlLng + t ** 2 * lng2;
    points.push([lat, lng]);
  }
  return points;
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
          mode: g.rows[0]?.incomingMode ?? null,
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
            mode: r.incomingMode,
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
        {points.slice(1).map((p, i) => {
          const prev = points[i];
          const isFlight = p.mode?.toLowerCase().includes("avion") ?? false;
          const positions = isFlight ? arcPoints(prev.lat, prev.lng, p.lat, p.lng) : ([[prev.lat, prev.lng], [p.lat, p.lng]] as [number, number][]);
          const mid = positions[Math.floor(positions.length / 2)];
          return (
            <Fragment key={i}>
              <Polyline positions={positions} pathOptions={{ color: modeLineColor(p.mode), weight: isFlight ? 2.5 : 3, dashArray: "6 4" }} />
              {isFlight && <Marker position={mid} icon={makePlaneIcon()} />}
            </Fragment>
          );
        })}
        {points.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]} icon={makePinIcon(p.label)}>
            <Tooltip>{p.name}</Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

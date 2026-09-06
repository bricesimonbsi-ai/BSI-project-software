import { Fragment, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { estimateCo2Kg, type CountryGroup, type FlatRow } from "@/features/voyages/itinerary/itinerary-model";
import { CountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";

function makePinIcon(label: string, active: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${active ? "hsl(24 94% 50%)" : "hsl(199 89% 48%)"};color:white;border-radius:9999px;width:${active ? "2.1rem" : "1.75rem"};height:${active ? "2.1rem" : "1.75rem"};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.7rem;box-shadow:0 1px 3px rgba(0,0,0,0.4);${active ? "outline:3px solid white;" : ""}">${label}</div>`,
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

/** Même émoji que la bibliothèque partagée (cf. itinerary-view.tsx) — pour le trajet affiché dans
 * le navigateur d'étapes en bas de carte. */
function transportEmoji(mode: string | null): string {
  if (!mode) return "🧭";
  const m = mode.toLowerCase();
  if (m.includes("avion")) return "✈️";
  if (m.includes("train")) return "🚆";
  if (m.includes("bus")) return "🚌";
  if (m.includes("taxi") || m.includes("vtc")) return "🚕";
  if (m.includes("voiture")) return "🚗";
  if (m.includes("ferry") || m.includes("bateau")) return "⛴️";
  return "🧭";
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

/** MapContainer est "non contrôlé" après son montage initial (changer `center` ne bouge rien) —
 * ce petit composant interne (à l'intérieur du contexte Leaflet) recentre la carte à chaque
 * changement d'étape active, pour que le navigateur d'étapes en bas pilote vraiment la carte. */
function FlyToStep({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 5), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

export function MapView({ groups, flat }: { groups: CountryGroup[]; flat: FlatRow[] }) {
  const [level, setLevel] = useState<"pays" | "villes">("villes");
  const [activeIndex, setActiveIndex] = useState(0);

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
      flat
        .filter((r) => r.sousEtape.latitude != null && r.sousEtape.longitude != null)
        .map((r) => ({
          lat: r.sousEtape.latitude as number,
          lng: r.sousEtape.longitude as number,
          label: String(r.globalIndex),
          name: r.sousEtape.city,
          mode: r.incomingMode,
        })),
    [flat]
  );

  const points = level === "pays" ? countryPoints : cityPoints;
  const center = points.length > 0 ? ([points[0].lat, points[0].lng] as [number, number]) : ([20, -60] as [number, number]);
  const clampedIndex = Math.min(activeIndex, Math.max(0, flat.length - 1));
  const activeStep = flat[clampedIndex];
  const nextStep = flat[clampedIndex + 1];
  const co2 = nextStep ? estimateCo2Kg(nextStep.incomingDistanceKm, nextStep.incomingMode) : null;

  if (points.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        Ajoute des coordonnées GPS (latitude/longitude) sur tes étapes pour voir la carte.
      </div>
    );
  }

  return (
    // Sort du conteneur centré de la page (quel que soit son padding) pour occuper toute la
    // largeur de l'écran — la vue Carte est pensée comme un plein écran immersif, pas une vignette
    // au milieu d'une page qui défile.
    <div className="relative left-1/2 w-screen -translate-x-1/2">
      <div className="relative isolate h-[75vh] overflow-hidden sm:h-[80vh]">
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
          {level === "villes" && activeStep?.sousEtape.latitude != null && activeStep.sousEtape.longitude != null && (
            <FlyToStep lat={activeStep.sousEtape.latitude} lng={activeStep.sousEtape.longitude} />
          )}
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
            <Marker
              key={i}
              position={[p.lat, p.lng]}
              icon={makePinIcon(p.label, level === "villes" && i === clampedIndex)}
              eventHandlers={level === "villes" ? { click: () => setActiveIndex(i) } : undefined}
            >
              <Tooltip>{p.name}</Tooltip>
            </Marker>
          ))}
        </MapContainer>

        {level === "villes" && activeStep && (
          <div className="absolute inset-x-0 bottom-0 z-[1000] border-t border-border bg-card/95 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center gap-2 px-2 py-2.5 sm:gap-3 sm:px-4">
              <button
                type="button"
                onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                disabled={clampedIndex === 0}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card disabled:opacity-30"
                title="Étape précédente"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="flex-shrink-0 text-xs">
                    {activeStep.globalIndex}
                  </Badge>
                  <CountryFlag name={activeStep.etape.country_region} className="flex-shrink-0" />
                  <span className="truncate text-sm font-semibold">{activeStep.sousEtape.city}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDate(activeStep.sousEtape.start_date)} au {formatDate(activeStep.sousEtape.end_date)} ·{" "}
                  {activeStep.sousEtape.duration_days ?? 0} nuits
                </p>
              </div>

              {nextStep && (
                <div className="flex flex-shrink-0 flex-col items-center gap-0.5 text-center">
                  <span className="text-base leading-none">{transportEmoji(nextStep.incomingMode)}</span>
                  {nextStep.incomingDistanceKm != null && (
                    <span className="whitespace-nowrap text-[0.65rem] text-muted-foreground">
                      {Math.round(nextStep.incomingDistanceKm).toLocaleString("fr-FR")} km
                    </span>
                  )}
                  {co2 != null && co2 > 0 && (
                    <span className="whitespace-nowrap text-[0.6rem] text-emerald-600 dark:text-emerald-400">{co2} kg CO₂</span>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setActiveIndex((i) => Math.min(flat.length - 1, i + 1))}
                disabled={clampedIndex >= flat.length - 1}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card disabled:opacity-30"
                title="Étape suivante"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

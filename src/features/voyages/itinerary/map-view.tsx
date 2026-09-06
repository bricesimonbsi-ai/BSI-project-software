import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { estimateCo2Kg, type CountryGroup, type FlatRow } from "@/features/voyages/itinerary/itinerary-model";
import { CountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { useJournalPosts, journalPhotoUrl } from "@/features/voyages/journal/use-journal";
import { useCityPhoto } from "@/features/voyages/itinerary/city-photo";
import { Button } from "@/components/ui/button";
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

export function MapView({ groups, flat, voyageId }: { groups: CountryGroup[]; flat: FlatRow[]; voyageId: string }) {
  const [level, setLevel] = useState<"pays" | "villes">("villes");
  const [activeIndex, setActiveIndex] = useState(0);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Réutilise les photos déjà publiées dans le Journal de voyage pour cette ville (première
  // trouvée) plutôt que d'aller chercher une image externe — pas de nouvelle dépendance, et une
  // vraie photo du voyageur quand elle existe plutôt qu'un stock générique.
  const { data: journalPosts } = useJournalPosts(voyageId);
  const photoBySousEtape = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of journalPosts ?? []) {
      if (!p.sous_etape_id || map.has(p.sous_etape_id)) continue;
      const photo = p.voyage_journal_photos[0];
      if (photo) map.set(p.sous_etape_id, journalPhotoUrl(photo.storage_path));
    }
    return map;
  }, [journalPosts]);

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

  // Fait défiler le bandeau jusqu'à la carte active quand la sélection change depuis la carte
  // (clic sur un point) — pas seulement quand on clique une carte du bandeau lui-même.
  useEffect(() => {
    cardRefs.current[clampedIndex]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [clampedIndex]);

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
          {/* Fond de carte CARTO Voyager plutôt que les tuiles OSM brutes : cartographie plus
              soignée (couleurs, labels) et tuiles retina (`{r}` = "@2x" sur écran haute densité,
              via detectRetina) — la carte précédente avait l'air moins nette une fois agrandie en
              plein écran, faute de tuiles adaptées aux écrans de téléphone modernes. Gratuit, sans
              clé, même logique "pas de dépendance à un service payant" que le reste du module. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
            detectRetina
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
            <div className="flex gap-2 overflow-x-auto px-3 py-3" style={{ scrollSnapType: "x proximity" }}>
              {flat.map((row, i) => (
                <Fragment key={row.sousEtape.id}>
                  <StepCard
                    row={row}
                    isActive={i === clampedIndex}
                    journalPhotoUrl={photoBySousEtape.get(row.sousEtape.id)}
                    onClick={() => setActiveIndex(i)}
                    cardRef={(el) => (cardRefs.current[i] = el)}
                  />
                  {i < flat.length - 1 && <ConnectorCell nextStep={flat[i + 1]} />}
                </Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Carte "étape" du bandeau du bas — photo (priorité à la première photo du Journal pour cette
 * ville si publiée, sinon un paysage représentatif tiré de Wikipédia, dégradé en tout dernier
 * recours), numéro, ville, dates. Cliquer dessus recentre la carte sur cette étape (voir
 * FlyToStep) : c'est la seule façon de naviguer entre les étapes depuis ce bandeau (avec le clic
 * sur un point de la carte), volontairement en défilement horizontal façon "story" — la
 * comparaison avec l'app de référence l'a explicitement demandé pour cet écran, à la différence
 * du reste de l'application qui évite le défilement horizontal pour lire une information. */
function StepCard({
  row,
  isActive,
  journalPhotoUrl,
  onClick,
  cardRef,
}: {
  row: FlatRow;
  isActive: boolean;
  journalPhotoUrl: string | undefined;
  onClick: () => void;
  cardRef: (el: HTMLButtonElement | null) => void;
}) {
  const { data: fallbackPhoto } = useCityPhoto(journalPhotoUrl ? null : row.sousEtape.city);
  const photoUrl = journalPhotoUrl ?? fallbackPhoto ?? undefined;
  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onClick}
      style={{ scrollSnapAlign: "center", background: photoUrl ? undefined : "linear-gradient(135deg, hsl(199 55% 26%), hsl(250 45% 18%))" }}
      className={cn(
        "relative flex h-36 w-52 flex-shrink-0 flex-col justify-end overflow-hidden rounded-xl text-left shadow-sm transition sm:h-40 sm:w-60",
        isActive ? "ring-2 ring-accent ring-offset-2 ring-offset-card" : "ring-1 ring-border hover:ring-accent/50"
      )}
    >
      {photoUrl && <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
      <span className="absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-black shadow">
        {row.globalIndex}
      </span>
      <div className="relative z-10 space-y-0.5 p-2.5 text-white">
        <p className="flex items-center gap-1.5 truncate text-sm font-bold">
          <CountryFlag name={row.etape.country_region} className="flex-shrink-0" />
          <span className="truncate">{row.sousEtape.city}</span>
        </p>
        <p className="truncate text-[0.7rem] text-white/85">
          {formatDate(row.sousEtape.start_date)}
          {row.sousEtape.duration_days ? ` · ${row.sousEtape.duration_days} nuits` : ""}
        </p>
      </div>
    </button>
  );
}

/** Connecteur entre deux cartes du bandeau — transport, distance et CO2 estimé du trajet entre
 * les deux étapes (mêmes calculs que l'onglet Bilan carbone). */
function ConnectorCell({ nextStep }: { nextStep: FlatRow }) {
  const co2 = estimateCo2Kg(nextStep.incomingDistanceKm, nextStep.incomingMode);
  return (
    <div className="flex h-36 w-20 flex-shrink-0 flex-col items-center justify-center gap-1 sm:h-40 sm:w-24">
      <span className="text-xl leading-none">{transportEmoji(nextStep.incomingMode)}</span>
      {nextStep.incomingDistanceKm != null && (
        <span className="whitespace-nowrap text-[0.65rem] text-muted-foreground">
          {Math.round(nextStep.incomingDistanceKm).toLocaleString("fr-FR")} km
        </span>
      )}
      {co2 > 0 && <span className="whitespace-nowrap text-[0.6rem] text-emerald-600 dark:text-emerald-400">{co2} kg CO₂</span>}
    </div>
  );
}

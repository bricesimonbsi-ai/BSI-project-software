import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2, Minimize2 } from "lucide-react";
import { estimateCo2Kg, type CountryGroup, type FlatRow } from "@/features/voyages/itinerary/itinerary-model";
import { CountryFlag } from "@/features/voyages/itinerary/location-pickers";
import { useJournalPosts, journalPhotoUrl } from "@/features/voyages/journal/use-journal";
import { useCityPhoto } from "@/features/voyages/itinerary/city-photo";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";

/** Fond de carte plus soigné (style MapTiler "Streets" — labels et couleurs proches de l'app de
 * référence citée par l'utilisateur), utilisé seulement si une clé est configurée (VITE_MAPTILER_API_KEY,
 * gratuite sur maptiler.com — même logique que VITE_TMDB_API_KEY/VITE_GOOGLE_PLACES_API_KEY ailleurs
 * dans l'app : actif si la clé est renseignée, repli sur OpenStreetMap standard sinon). */
const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;
const TILE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`
  : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = MAPTILER_KEY
  ? '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** `label` peut être un simple numéro ("12") en vue Villes ou une plage ("12–19") en vue Pays —
 * largeur automatique (min 1.75rem, padding latéral) plutôt qu'un cercle à taille fixe, pour que
 * les plages à deux chiffres ne débordent jamais du pin. */
function makePinIcon(label: string, active: boolean) {
  const size = active ? "2.1rem" : "1.75rem";
  return L.divIcon({
    className: "",
    html: `<div style="background:${active ? "hsl(24 94% 50%)" : "hsl(199 89% 48%)"};color:white;border-radius:9999px;min-width:${size};height:${size};padding:0 0.35rem;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.7rem;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.4);${active ? "outline:3px solid white;" : ""}">${label}</div>`,
    iconSize: [36, 28],
    iconAnchor: [18, 14],
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

/** Leaflet calcule sa taille au montage et ne la recalcule jamais tout seul si son conteneur
 * change de taille par un autre moyen que son propre resize (ex. passage en plein écran) — sans
 * ça la carte resterait affichée à sa petite taille d'origine, coupée, le temps d'un pan/zoom. */
function InvalidateSizeOnChange({ trigger }: { trigger: boolean }) {
  const map = useMap();
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(id);
  }, [map, trigger]);
  return null;
}

export function MapView({ groups, flat, voyageId }: { groups: CountryGroup[]; flat: FlatRow[]; voyageId: string }) {
  const [level, setLevel] = useState<"pays" | "villes">("villes");
  const [activeIndex, setActiveIndex] = useState(0);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sort du conteneur centré de la page pour occuper toute la largeur de l'écran, quel que soit
  // son padding — la vue Carte est pensée comme un plein écran immersif. Le classique "left-1/2
  // w-screen -translate-x-1/2" (pourcentages CSS) dépend du conteneur englobant pour la résolution
  // de `left: 50%`, qui n'est PAS toujours le vrai viewport selon la profondeur d'imbrication de la
  // page (observé : carte décalée, bord droit tronqué sur certaines largeurs de fenêtre). On mesure
  // donc directement la position réelle de l'élément via getBoundingClientRect (toujours relative
  // au viewport, sans ambiguïté) et on applique une largeur/marge en pixels, recalculées au resize.
  const breakoutRef = useRef<HTMLDivElement>(null);
  const [bleed, setBleed] = useState<{ width: number; marginLeft: number } | null>(null);
  useLayoutEffect(() => {
    function measure() {
      if (!breakoutRef.current) return;
      const rect = breakoutRef.current.getBoundingClientRect();
      setBleed({ width: window.innerWidth, marginLeft: -rect.left });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === fullscreenRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      fullscreenRef.current?.requestFullscreen();
    }
  }

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

  // Les coordonnées du PAYS (etape.latitude/longitude) ne sont saisies que via le dialogue manuel
  // d'édition d'une étape — un itinéraire importé par CSV (le cas le plus courant) ne les remplit
  // jamais, seulement celles des villes. Sans repli, la vue Pays restait donc vide pour tout
  // itinéraire importé : on retombe sur la position de la première ville du pays qui a des
  // coordonnées, cohérent avec la vue Villes qui s'appuie déjà sur ces mêmes coordonnées.
  const countryPoints = useMemo(
    () =>
      groups
        .map((g) => {
          const firstCityWithCoords = g.rows.find((r) => r.sousEtape.latitude != null && r.sousEtape.longitude != null);
          const lat = g.etape.latitude ?? firstCityWithCoords?.sousEtape.latitude ?? null;
          const lng = g.etape.longitude ?? firstCityWithCoords?.sousEtape.longitude ?? null;
          return { g, lat, lng };
        })
        .filter((p): p is { g: CountryGroup; lat: number; lng: number } => p.lat != null && p.lng != null)
        .map(({ g, lat, lng }) => ({
          lat,
          lng,
          label: g.stepRangeLabel,
          name: g.etape.country_region,
          mode: g.rows[0]?.incomingMode ?? null,
          firstGlobalIndex: g.rows[0]?.globalIndex ?? 1,
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
          firstGlobalIndex: r.globalIndex,
        })),
    [flat]
  );

  const points = level === "pays" ? countryPoints : cityPoints;
  const center = points.length > 0 ? ([points[0].lat, points[0].lng] as [number, number]) : ([20, -60] as [number, number]);
  const clampedIndex = Math.min(activeIndex, Math.max(0, flat.length - 1));
  const activeStep = flat[clampedIndex];

  // Fait défiler le bandeau jusqu'à la carte active quand la sélection change depuis la carte
  // (clic sur un point) — pas seulement quand on clique une carte du bandeau lui-même. Alignement
  // "start" (pas "center") pour la toute première étape : la centrer demanderait un scroll négatif
  // impossible, et le défilement par ancrage (scroll-snap) du bandeau peut alors entrer en
  // conflit avec cet appel et caler sur une autre carte que la première au chargement. `flat.length`
  // dans les dépendances : au premier rendu, `flat` peut être encore vide (données pas chargées),
  // l'effet doit se redéclencher une fois les vraies cartes montées dans le DOM.
  useEffect(() => {
    cardRefs.current[clampedIndex]?.scrollIntoView({
      behavior: "smooth",
      inline: clampedIndex === 0 ? "start" : "center",
      block: "nearest",
    });
  }, [clampedIndex, flat.length]);

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
    // au milieu d'une page qui défile. Hauteur en dvh (pas vh) pour la vraie hauteur visible sur
    // mobile (la barre d'adresse variable fausse vh) ; le bandeau d'étapes en bas est volontairement
    // compact pour laisser le plus de place possible à la carte elle-même. `bleed` (mesuré via
    // getBoundingClientRect, voir plus haut) — tant qu'il n'est pas encore mesuré (tout premier
    // rendu), pas de style de largeur/marge : le conteneur reste à sa largeur normale un instant
    // plutôt que de déborder de façon incorrecte.
    <div ref={breakoutRef} style={bleed ? { width: bleed.width, marginLeft: bleed.marginLeft } : undefined}>
      <div
        ref={fullscreenRef}
        className={cn("relative isolate overflow-hidden bg-background", isFullscreen ? "h-screen" : "h-[85dvh] sm:h-[90dvh]")}
      >
        <div className="absolute right-3 top-3 z-[1000] flex items-center gap-1.5">
          <div className="flex gap-1 rounded-full border border-border bg-card/90 p-1 backdrop-blur">
            <Button
              size="sm"
              variant={level === "pays" ? "default" : "ghost"}
              className="h-6 rounded-full px-2.5 text-xs"
              onClick={() => setLevel("pays")}
            >
              Pays
            </Button>
            <Button
              size="sm"
              variant={level === "villes" ? "default" : "ghost"}
              className="h-6 rounded-full px-2.5 text-xs"
              onClick={() => setLevel("villes")}
            >
              Villes
            </Button>
          </div>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-full bg-card/90 backdrop-blur"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
        <MapContainer center={center} zoom={2} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
          <TileLayer key={TILE_URL} attribution={TILE_ATTRIBUTION} url={TILE_URL} detectRetina={!!MAPTILER_KEY} maxZoom={20} />
          <InvalidateSizeOnChange trigger={isFullscreen} />
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
              eventHandlers={{
                click: () => {
                  if (level === "pays") {
                    setLevel("villes");
                    setActiveIndex(p.firstGlobalIndex - 1);
                  } else {
                    setActiveIndex(i);
                  }
                },
              }}
            >
              <Tooltip>{p.name}</Tooltip>
            </Marker>
          ))}
        </MapContainer>

        {level === "villes" && activeStep && (
          <div className="absolute inset-x-0 bottom-0 z-[1000] border-t border-border bg-card/95 backdrop-blur">
            <div className="flex gap-1.5 overflow-x-auto px-2 py-2" style={{ scrollSnapType: "x proximity" }}>
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
  const { data: fallbackPhoto } = useCityPhoto(journalPhotoUrl ? null : row.sousEtape.city, row.etape.country_region);
  const rawPhotoUrl = journalPhotoUrl ?? fallbackPhoto ?? undefined;
  // Filet de sécurité : si l'image échoue au chargement (URL cassée, réseau lent...), on retombe
  // sur le dégradé plutôt que de laisser une carte vide — sans ça, `photoUrl` restait "vrai" côté
  // style (donc pas de dégradé) alors que l'<img> elle-même ne s'affichait jamais.
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [rawPhotoUrl]);
  const photoUrl = imgFailed ? undefined : rawPhotoUrl;

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onClick}
      style={{ scrollSnapAlign: "center", background: photoUrl ? undefined : "linear-gradient(135deg, hsl(199 55% 30%), hsl(250 45% 22%))" }}
      className={cn(
        "relative flex h-24 w-36 flex-shrink-0 flex-col justify-end overflow-hidden rounded-xl text-left shadow-sm transition sm:h-28 sm:w-44",
        isActive ? "ring-2 ring-accent ring-offset-2 ring-offset-card" : "ring-1 ring-border hover:ring-accent/50"
      )}
    >
      {photoUrl && (
        <>
          <img src={photoUrl} alt="" onError={() => setImgFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
          {/* Overlay de lisibilité du texte : uniquement par-dessus une vraie photo — appliqué
              aussi sur le dégradé seul, il l'assombrissait presque jusqu'au noir (carte "vide"). */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
        </>
      )}
      <span className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[0.65rem] font-bold text-black shadow">
        {row.globalIndex}
      </span>
      <div className="relative z-10 space-y-0 p-1.5 text-white">
        <p className="flex items-center gap-1 truncate text-xs font-bold">
          <CountryFlag name={row.etape.country_region} className="flex-shrink-0" />
          <span className="truncate">{row.sousEtape.city}</span>
        </p>
        <p className="truncate text-[0.6rem] text-white/85">
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
    <div className="flex h-24 w-14 flex-shrink-0 flex-col items-center justify-center gap-0.5 sm:h-28 sm:w-16">
      <span className="text-base leading-none">{transportEmoji(nextStep.incomingMode)}</span>
      {nextStep.incomingDistanceKm != null && (
        <span className="whitespace-nowrap text-[0.6rem] text-muted-foreground">
          {Math.round(nextStep.incomingDistanceKm).toLocaleString("fr-FR")} km
        </span>
      )}
      {co2 > 0 && <span className="whitespace-nowrap text-[0.55rem] text-emerald-600 dark:text-emerald-400">{co2} kg CO₂</span>}
    </div>
  );
}

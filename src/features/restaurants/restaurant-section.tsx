import { useEffect, useMemo, useState } from "react";
import {
  searchPlaces,
  nearbyPlaces,
  getCurrentPosition,
  placePhotoUrl,
  priceLevelSymbol,
  readableTypes,
  isGooglePlacesConfigured,
  type GooglePlaceResult,
} from "@/features/restaurants/google-places";
import {
  useRestaurantItems,
  useAddPlaceRestaurant,
  useAddManualRestaurant,
  useToggleVisited,
  useRestaurantItemVisitors,
  useRestaurantItemRatings,
  useSetRestaurantItemRating,
  useDeleteRestaurantItemRating,
  useUpdateRestaurantItem,
  useDeleteRestaurantItem,
  type PlaceAddInput,
} from "@/features/restaurants/use-restaurant-list";
import { useProjectPeople, type ProjectPersonRow } from "@/features/people/use-people";
import { PersonAvatarBadge } from "@/features/people/person-avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Star, Trash2, UtensilsCrossed, MapPin, Phone, Globe, Clock, Navigation, Plus, X } from "lucide-react";
import {
  RESTAURANT_TYPE_LABELS,
  RESTAURANT_TYPE_PLACE_TYPES,
  SUGGESTED_STYLE_TAGS,
} from "@/features/restaurants/restaurant-constants";
import { PodiumBoard, PersonRankingPanels, type PodiumEntry } from "@/features/shared/rating-podium";
import { cn } from "@/lib/utils";
import type { RestaurantItem, RestaurantItemRating, Person, RestaurantType } from "@/types/database";

type RatingRow = RestaurantItemRating & { people: Person };

type NormalizedResult = {
  id: string;
  name: string;
  address: string | null;
  photoUrl: string | null;
  rating: number | null;
  priceLevel: string | null;
  categories: string[];
  addInput: PlaceAddInput;
};

/** Regroupe les lieux par style d'établissement (premier tag de `categories`, "Sans catégorie" à
 * défaut), groupes triés alphabétiquement — c'est le "classement" demandé, indépendant des notes
 * et de l'ordre d'ajout. */
function groupByStyle<T extends RestaurantItem>(list: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of list) {
    const key = item.categories[0] ?? "Sans catégorie";
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function toPodiumEntry({ item, avg }: { item: RestaurantItem; avg: number }): PodiumEntry {
  return { id: item.id, title: item.name, imageUrl: item.photo_url, avg };
}

function normalizePlace(p: GooglePlaceResult): NormalizedResult {
  const photoUrl = p.photos?.[0]?.name ? placePhotoUrl(p.photos[0].name) : null;
  const categories = readableTypes(p.types);
  return {
    id: p.id,
    name: p.displayName?.text ?? "Sans nom",
    address: p.formattedAddress ?? null,
    photoUrl,
    rating: p.rating ?? null,
    priceLevel: priceLevelSymbol(p.priceLevel),
    categories,
    addInput: {
      place_id: p.id,
      name: p.displayName?.text ?? "Sans nom",
      address: p.formattedAddress ?? null,
      categories,
      photo_url: photoUrl,
      google_rating: p.rating ?? null,
      price_level: priceLevelSymbol(p.priceLevel),
      phone: p.internationalPhoneNumber ?? null,
      website: p.websiteUri ?? null,
      opening_hours: p.regularOpeningHours?.weekdayDescriptions ?? [],
      latitude: p.location?.latitude ?? null,
      longitude: p.location?.longitude ?? null,
    },
  };
}

/**
 * Contenu du projet "Bars & Restaurants" : Suggestions à proximité (géolocalisation + Google
 * Places), Ma liste (recherche + ajout, ou saisie manuelle nom/adresse si Google Places n'est pas
 * configuré), Visités (classé par année, avec qui y est allé) et Synthèse (meilleures/pires notes).
 */
export function RestaurantSection({ projectId, restaurantType }: { projectId: string; restaurantType: RestaurantType | null }) {
  const autoAvailable = isGooglePlacesConfigured();
  const placeLabel = restaurantType ? RESTAURANT_TYPE_LABELS[restaurantType].plural.toLowerCase() : "bars/restaurants";
  const { data: items, isLoading } = useRestaurantItems(projectId);
  const { data: linkedPeople } = useProjectPeople(projectId);
  const itemIds = useMemo(() => (items ?? []).map((i) => i.id), [items]);
  const { data: visitors } = useRestaurantItemVisitors(projectId, itemIds);
  const { data: ratings } = useRestaurantItemRatings(projectId, itemIds);
  const addPlace = useAddPlaceRestaurant(projectId);
  const addManual = useAddManualRestaurant(projectId);
  const toggleVisited = useToggleVisited(projectId);
  const updateItem = useUpdateRestaurantItem(projectId);
  const deleteItem = useDeleteRestaurantItem(projectId);
  const setRating = useSetRestaurantItemRating(projectId);
  const deleteRating = useDeleteRestaurantItemRating(projectId);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NormalizedResult[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [nearbyAsked, setNearbyAsked] = useState(false);
  const [expanded, setExpanded] = useState<RestaurantItem | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [pendingVisit, setPendingVisit] = useState<RestaurantItem | null>(null);
  const [pendingVisitors, setPendingVisitors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!autoAvailable) return;
    if (!query.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        setResults((await searchPlaces(query)).map(normalizePlace).slice(0, 8));
        setSearchError(null);
      } catch (err) {
        setSearchError((err as Error).message);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [query, autoAvailable]);

  async function handleUseLocation() {
    setNearbyAsked(true);
    setNearbyLoading(true);
    setNearbyError(null);
    try {
      const position = await getCurrentPosition();
      const includedTypes = restaurantType ? RESTAURANT_TYPE_PLACE_TYPES[restaurantType] : undefined;
      const places = await nearbyPlaces(position.coords.latitude, position.coords.longitude, includedTypes);
      setNearby(places.map(normalizePlace));
    } catch (err) {
      setNearbyError((err as Error).message);
    } finally {
      setNearbyLoading(false);
    }
  }

  const existingPlaceIds = new Set((items ?? []).map((i) => i.place_id));

  async function handleAddResult(result: NormalizedResult) {
    await addPlace.mutateAsync(result.addInput);
    setQuery("");
    setResults([]);
  }

  async function handleManualAdd() {
    if (!manualName.trim()) return;
    await addManual.mutateAsync({ name: manualName.trim(), address: manualAddress.trim() });
    setManualName("");
    setManualAddress("");
  }

  function requestToggle(item: RestaurantItem, checked: boolean) {
    if (!checked) {
      toggleVisited.mutate({ id: item.id, visited: false });
      return;
    }
    setPendingVisit(item);
    setPendingVisitors(new Set());
  }

  function confirmVisit() {
    if (!pendingVisit) return;
    toggleVisited.mutate({ id: pendingVisit.id, visited: true, visitorIds: [...pendingVisitors] });
    setPendingVisit(null);
  }

  const visitorNamesByItem = new Map<string, string[]>();
  for (const v of visitors ?? []) {
    if (!v.people) continue;
    const list = visitorNamesByItem.get(v.restaurant_item_id) ?? [];
    list.push(v.people.name);
    visitorNamesByItem.set(v.restaurant_item_id, list);
  }

  const notVisited = (items ?? []).filter((i) => !i.visited);
  const visited = (items ?? []).filter((i) => i.visited);
  const visitedByYear = useMemo(() => {
    const map = new Map<string, RestaurantItem[]>();
    for (const item of visited) {
      const year = (item.visited_at ?? item.created_at).slice(0, 4);
      map.set(year, [...(map.get(year) ?? []), item]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visited]);
  const notVisitedByStyle = useMemo(() => groupByStyle(notVisited), [notVisited]);

  const ratingsByItemId = new Map<string, RatingRow[]>();
  for (const r of (ratings ?? []) as RatingRow[]) {
    if (!r.people) continue;
    const list = ratingsByItemId.get(r.restaurant_item_id) ?? [];
    list.push(r);
    ratingsByItemId.set(r.restaurant_item_id, list);
  }
  const itemsById = new Map((items ?? []).map((i) => [i.id, { title: i.name, imageUrl: i.photo_url }]));

  const currentYear = new Date().getFullYear().toString();
  const ratedEntries = visited
    .map((item) => {
      const list = ratingsByItemId.get(item.id) ?? [];
      if (list.length === 0) return null;
      const avg = list.reduce((sum, r) => sum + r.rating, 0) / list.length;
      const year = (item.visited_at ?? item.created_at).slice(0, 4);
      return { item, avg, year };
    })
    .filter((x): x is { item: RestaurantItem; avg: number; year: string } => x !== null);
  const ratedThisYear = ratedEntries.filter((e) => e.year === currentYear);
  const bestAllTime = [...ratedEntries].sort((a, b) => b.avg - a.avg).slice(0, 5);
  const worstAllTime = [...ratedEntries].sort((a, b) => a.avg - b.avg).slice(0, 5);
  const bestThisYear = [...ratedThisYear].sort((a, b) => b.avg - a.avg).slice(0, 5);
  const worstThisYear = [...ratedThisYear].sort((a, b) => a.avg - b.avg).slice(0, 5);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="proximite">
        <TabsList>
          <TabsTrigger value="proximite">À proximité</TabsTrigger>
          <TabsTrigger value="ma-liste">Ma liste ({notVisited.length})</TabsTrigger>
          <TabsTrigger value="visites">Visités ({visited.length})</TabsTrigger>
          <TabsTrigger value="synthese">Synthèse</TabsTrigger>
        </TabsList>

        <TabsContent value="proximite" className="pt-3">
          {!autoAvailable ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Pas de source automatique de suggestions sans clé Google Places configurée — ajoute-les depuis l'onglet "Ma
              liste".
            </p>
          ) : !nearbyAsked ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-muted-foreground">Trouve des {placeLabel} autour de toi.</p>
              <Button type="button" onClick={handleUseLocation}>
                <Navigation className="mr-2 h-4 w-4" /> Utiliser ma position
              </Button>
            </div>
          ) : nearbyLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Recherche autour de toi...</p>
          ) : nearbyError ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-destructive">{nearbyError}</p>
              <Button type="button" variant="outline" onClick={handleUseLocation}>
                Réessayer
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {nearby
                .filter((r) => !existingPlaceIds.has(r.id))
                .map((r) => (
                  <NearbyCard key={r.id} result={r} onAdd={() => handleAddResult(r)} />
                ))}
              {nearby.length === 0 && (
                <p className="col-span-full py-6 text-center text-sm text-muted-foreground">Rien trouvé à proximité.</p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ma-liste" className="space-y-3 pt-3">
          {autoAvailable ? (
            <Card>
              <CardContent className="relative p-4">
                <Input placeholder={`Rechercher un ${restaurantType ? RESTAURANT_TYPE_LABELS[restaurantType].singular.toLowerCase() : "bar/restaurant"} à ajouter...`} value={query} onChange={(e) => setQuery(e.target.value)} />
                {searchError && <p className="mt-2 text-xs text-destructive">{searchError}</p>}
                {(results.length > 0 || searching) && (
                  <div className="absolute inset-x-4 top-[calc(100%-0.5rem)] z-20 max-h-80 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                    {searching && <p className="p-3 text-sm text-muted-foreground">Recherche...</p>}
                    {!searching &&
                      results.map((r) => {
                        const already = existingPlaceIds.has(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            disabled={already}
                            onClick={() => handleAddResult(r)}
                            className="flex w-full items-center gap-3 border-b border-border p-2 text-left last:border-0 hover:bg-secondary disabled:opacity-50"
                          >
                            {r.photoUrl ? (
                              <img src={r.photoUrl} alt="" className="h-14 w-14 flex-shrink-0 rounded object-cover" />
                            ) : (
                              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded bg-muted">
                                <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{r.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {r.address ?? "?"} {already && "· déjà dans la liste"}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="space-y-3 p-4">
                <Input placeholder="Nom du lieu" value={manualName} onChange={(e) => setManualName(e.target.value)} />
                <Input placeholder="Adresse (optionnel)" value={manualAddress} onChange={(e) => setManualAddress(e.target.value)} />
                <Button type="button" size="sm" onClick={handleManualAdd} disabled={!manualName.trim()}>
                  Ajouter
                </Button>
              </CardContent>
            </Card>
          )}

          {notVisited.length === 0 && !isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Rien en attente.</p>
          ) : (
            <div className="space-y-4">
              {notVisitedByStyle.map(([style, styleItems]) => (
                <div key={style} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {style} ({styleItems.length})
                  </p>
                  {styleItems.map((item) => (
                    <RestaurantRow
                      key={item.id}
                      item={item}
                      visitorNames={visitorNamesByItem.get(item.id) ?? []}
                      onToggle={(c) => requestToggle(item, c)}
                      onDelete={() => deleteItem.mutate(item.id)}
                      onOpen={() => setExpanded(item)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="visites" className="space-y-5 pt-3">
          {visitedByYear.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Rien pour l'instant.</p>
          ) : (
            visitedByYear.map(([year, yearItems]) => (
              <div key={year} className="space-y-3">
                <p className="text-sm font-semibold">
                  {year} ({yearItems.length})
                </p>
                {groupByStyle(yearItems).map(([style, styleItems]) => (
                  <div key={style} className="space-y-2 pl-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {style} ({styleItems.length})
                    </p>
                    {styleItems.map((item) => (
                      <RestaurantRow
                        key={item.id}
                        item={item}
                        visitorNames={visitorNamesByItem.get(item.id) ?? []}
                        onToggle={(c) => requestToggle(item, c)}
                        onDelete={() => deleteItem.mutate(item.id)}
                        onOpen={() => setExpanded(item)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="synthese" className="space-y-6 pt-3">
          <div className="grid gap-6 sm:grid-cols-2">
            <PodiumBoard title={`Mieux notés en ${currentYear}`} entries={bestThisYear.map(toPodiumEntry)} tone="best" />
            <PodiumBoard title={`Moins bien notés en ${currentYear}`} entries={worstThisYear.map(toPodiumEntry)} tone="worst" />
            <PodiumBoard title="Mieux notés de tous les temps" entries={bestAllTime.map(toPodiumEntry)} tone="best" />
            <PodiumBoard title="Moins bien notés de tous les temps" entries={worstAllTime.map(toPodiumEntry)} tone="worst" />
          </div>
          <PersonRankingPanels
            people={linkedPeople ?? []}
            ratings={((ratings ?? []) as RatingRow[]).filter((r) => r.people).map((r) => ({
              person_id: r.person_id,
              itemId: r.restaurant_item_id,
              rating: r.rating,
            }))}
            itemsById={itemsById}
          />
        </TabsContent>
      </Tabs>

      {autoAvailable && <p className="text-center text-[0.65rem] text-muted-foreground">Données fournies par Google Places.</p>}

      <Dialog open={!!expanded} onOpenChange={(open) => !open && setExpanded(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          {expanded && (
            <ExpandedRestaurantDetails
              item={expanded}
              restaurantType={restaurantType}
              people={linkedPeople ?? []}
              ratings={ratingsByItemId.get(expanded.id) ?? []}
              onSaveRating={(personId, rating, comment) =>
                setRating.mutate({ restaurantItemId: expanded.id, personId, rating, comment })
              }
              onDeleteRating={(id) => deleteRating.mutate(id)}
              onUpdateCategories={(categories) => updateItem.mutate({ id: expanded.id, categories })}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingVisit} onOpenChange={(o) => !o && setPendingVisit(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Qui y est allé ?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(linkedPeople ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune personne associée à ce projet (onglet Personnes).</p>
            ) : (
              (linkedPeople ?? []).map((l, i) => (
                <label key={l.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={pendingVisitors.has(l.person_id)}
                    onCheckedChange={(checked) =>
                      setPendingVisitors((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(l.person_id);
                        else next.delete(l.person_id);
                        return next;
                      })
                    }
                  />
                  <PersonAvatarBadge
                    name={l.people.name}
                    avatarEmoji={l.people.avatar_emoji}
                    avatarConfig={l.people.avatar_config}
                    personId={l.people.id}
                    index={i}
                    className="h-6 w-6 text-xs"
                  />
                  {l.people.name}
                </label>
              ))
            )}
          </div>
          <Button className="w-full" onClick={confirmVisit}>
            Valider
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NearbyCard({ result, onAdd }: { result: NormalizedResult; onAdd: () => void }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border/60 bg-card p-2">
      {result.photoUrl ? (
        <img src={result.photoUrl} alt="" className="aspect-[4/3] w-full rounded object-cover" />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded bg-muted">
          <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <p className="truncate text-xs font-medium">{result.name}</p>
      <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground">
        <span>{result.priceLevel ?? "?"}</span>
        {result.rating != null && (
          <span className="flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {result.rating.toFixed(1)}
          </span>
        )}
      </div>
      <Button type="button" size="sm" variant="outline" className="h-7 w-full text-xs" onClick={onAdd}>
        Ajouter
      </Button>
    </div>
  );
}

function RestaurantRow({
  item,
  visitorNames,
  onToggle,
  onDelete,
  onOpen,
}: {
  item: RestaurantItem;
  visitorNames: string[];
  onToggle: (visited: boolean) => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-2.5">
      <Checkbox checked={item.visited} onCheckedChange={(c) => onToggle(!!c)} className="flex-shrink-0" />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {item.photo_url ? (
          <img src={item.photo_url} alt="" className="h-14 w-14 flex-shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded bg-muted">
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn("truncate text-sm font-medium", item.visited && "text-muted-foreground line-through")}>{item.name}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {item.address && <span className="truncate">{item.address}</span>}
            {item.google_rating != null && (
              <span className="flex flex-shrink-0 items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {item.google_rating.toFixed(1)}
              </span>
            )}
            {item.price_level && <span className="flex-shrink-0">{item.price_level}</span>}
          </div>
          {item.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.categories.map((c) => (
                <Badge key={c} variant="secondary" className="text-[0.65rem]">
                  {c}
                </Badge>
              ))}
            </div>
          )}
          {item.visited && visitorNames.length > 0 && <p className="text-xs text-muted-foreground">Visité par {visitorNames.join(", ")}</p>}
        </div>
      </button>
      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ExpandedRestaurantDetails({
  item,
  restaurantType,
  people,
  ratings,
  onSaveRating,
  onDeleteRating,
  onUpdateCategories,
}: {
  item: RestaurantItem;
  restaurantType: RestaurantType | null;
  people: ProjectPersonRow[];
  ratings: RatingRow[];
  onSaveRating: (personId: string, rating: number, comment: string | null) => void;
  onDeleteRating: (ratingId: string) => void;
  onUpdateCategories: (categories: string[]) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {item.photo_url ? (
          <img src={item.photo_url} alt="" className="h-28 w-28 flex-shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded bg-muted">
            <UtensilsCrossed className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="space-y-1">
          <h3 className="font-semibold leading-tight">{item.name}</h3>
          {item.address && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" /> {item.address}
            </p>
          )}
          {item.google_rating != null && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {item.google_rating.toFixed(1)}/5 (Google)
              {item.price_level && ` · ${item.price_level}`}
            </p>
          )}
          {item.phone && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 flex-shrink-0" /> {item.phone}
            </p>
          )}
          {item.website && (
            <a
              href={item.website}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <Globe className="h-3 w-3 flex-shrink-0" /> Site web
            </a>
          )}
          <StyleTagEditor
            categories={item.categories}
            suggestions={SUGGESTED_STYLE_TAGS[restaurantType ?? "restaurant"]}
            onChange={onUpdateCategories}
          />
        </div>
      </div>

      {item.opening_hours.length > 0 && (
        <div className="space-y-1 border-t border-border pt-3">
          <p className="flex items-center gap-1 text-sm font-semibold">
            <Clock className="h-3.5 w-3.5" /> Horaires
          </p>
          <ul className="text-xs text-muted-foreground">
            {item.opening_hours.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {item.visited && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-semibold">Notes</p>
          <RatingsSection people={people} ratings={ratings} onSave={onSaveRating} onDelete={onDeleteRating} />
        </div>
      )}
    </div>
  );
}

/** Tags de style éditables (classement par style d'établissement) — badges retirables + ajout
 * libre ou depuis les suggestions du modèle du projet (bar/restaurant), non encore utilisées. */
function StyleTagEditor({
  categories,
  suggestions,
  onChange,
}: {
  categories: string[];
  suggestions: string[];
  onChange: (categories: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || categories.includes(trimmed)) {
      setAdding(false);
      setValue("");
      return;
    }
    onChange([...categories, trimmed]);
    setValue("");
    setAdding(false);
  }

  function removeTag(tag: string) {
    onChange(categories.filter((c) => c !== tag));
  }

  const remainingSuggestions = suggestions.filter((s) => !categories.includes(s));

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex flex-wrap items-center gap-1">
        {categories.map((c) => (
          <Badge key={c} variant="secondary" className="flex items-center gap-1 text-[0.65rem]">
            {c}
            <button type="button" onClick={() => removeTag(c)} className="hover:text-destructive">
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        {adding ? (
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTag(value);
              if (e.key === "Escape") {
                setAdding(false);
                setValue("");
              }
            }}
            onBlur={() => (value.trim() ? addTag(value) : setAdding(false))}
            placeholder="Style..."
            className="h-6 w-28 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-0.5 rounded-full border border-dashed border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground hover:border-accent hover:text-accent"
          >
            <Plus className="h-2.5 w-2.5" /> Style
          </button>
        )}
      </div>
      {remainingSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {remainingSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground hover:border-accent hover:text-accent"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Note (/10) + commentaire libre par personne associée au projet — une note par personne et par
 * lieu, modifiable dans le temps (jamais un historique). */
function RatingsSection({
  people,
  ratings,
  onSave,
  onDelete,
}: {
  people: ProjectPersonRow[];
  ratings: RatingRow[];
  onSave: (personId: string, rating: number, comment: string | null) => void;
  onDelete: (ratingId: string) => void;
}) {
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState("");
  const [commentValue, setCommentValue] = useState("");

  const ratingByPerson = new Map(ratings.map((r) => [r.person_id, r]));

  function startEdit(personId: string) {
    const existing = ratingByPerson.get(personId);
    setEditingPersonId(personId);
    setRatingValue(existing ? String(existing.rating) : "");
    setCommentValue(existing?.comment ?? "");
  }

  function submit() {
    if (!editingPersonId) return;
    const value = Number(ratingValue.replace(",", "."));
    if (Number.isNaN(value) || value < 0 || value > 10) return;
    onSave(editingPersonId, value, commentValue.trim() || null);
    setEditingPersonId(null);
  }

  if (people.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune personne associée à ce projet pour l'instant (onglet Personnes).</p>;
  }

  return (
    <div className="space-y-2">
      {people.map((l) => {
        const existing = ratingByPerson.get(l.person_id);
        const isEditing = editingPersonId === l.person_id;
        return (
          <div key={l.id} className="rounded-md border border-border/60 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PersonAvatarBadge
                  name={l.people.name}
                  avatarEmoji={l.people.avatar_emoji}
                  avatarConfig={l.people.avatar_config}
                  personId={l.people.id}
                  index={0}
                  className="h-6 w-6 text-xs"
                />
                <span className="text-sm font-medium">{l.people.name}</span>
                {existing && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {existing.rating.toFixed(1)}/10
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => startEdit(l.person_id)}>
                  {existing ? "Modifier" : "Noter"}
                </Button>
                {existing && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(existing.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            {existing?.comment && !isEditing && <p className="mt-1 text-xs text-muted-foreground">{existing.comment}</p>}
            {isEditing && (
              <div className="mt-2 space-y-2">
                <Input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={ratingValue}
                  onChange={(e) => setRatingValue(e.target.value)}
                  placeholder="Note /10"
                  className="h-8 w-24 text-sm"
                />
                <Textarea
                  value={commentValue}
                  onChange={(e) => setCommentValue(e.target.value)}
                  placeholder="Commentaire (optionnel)"
                  rows={2}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={submit} disabled={!ratingValue.trim()}>
                    Enregistrer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingPersonId(null)}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  searchMovies,
  searchTvShows,
  trendingMovies,
  trendingTvShows,
  tmdbPosterUrl,
  isTmdbConfigured,
  type TmdbMovieResult,
  type TmdbTvResult,
} from "@/features/media/tmdb";
import { searchGames, trendingGames, isRawgConfigured, type RawgGameResult } from "@/features/media/rawg";
import {
  useMediaItems,
  useAddTmdbMedia,
  useAddRawgMedia,
  useAddManualMedia,
  useToggleWatched,
  useUpdateMediaItem,
  useDeleteMediaItem,
  useMediaItemWatchers,
  useMediaItemRatings,
  useSetMediaItemRating,
  useDeleteMediaItemRating,
  useSetMediaShareToken,
  type TmdbAddInput,
  type RawgAddInput,
} from "@/features/media/use-media-list";
import { useProjectPeople, type ProjectPersonRow } from "@/features/people/use-people";
import { PersonAvatarBadge } from "@/features/people/person-avatar";
import { CONSOLES, MEDIA_TYPE_LABELS, mediaPosterUrl } from "@/features/media/media-constants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Star, Trash2, Film, Tv, Gamepad2, Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_URL } from "@/lib/app-url";
import type { MediaItem, MediaItemRating, MediaType, Person } from "@/types/database";

type RatingRow = MediaItemRating & { people: Person };

const TYPE_ICON: Record<MediaType, typeof Film> = { film: Film, serie: Tv, jeu: Gamepad2 };

type NormalizedResult = {
  id: string;
  title: string;
  posterPath: string | null;
  year: string | undefined;
  rating: number;
  addInput: TmdbAddInput | RawgAddInput;
};

function normalizeMovie(m: TmdbMovieResult): NormalizedResult {
  return {
    id: String(m.id),
    title: m.title,
    posterPath: tmdbPosterUrl(m.poster_path),
    year: m.release_date?.slice(0, 4),
    rating: m.vote_average,
    addInput: {
      external_id: String(m.id),
      title: m.title,
      poster_path: m.poster_path,
      synopsis: m.overview || null,
      release_date: m.release_date || null,
      external_rating: m.vote_average || null,
    },
  };
}

function normalizeTv(t: TmdbTvResult): NormalizedResult {
  return {
    id: String(t.id),
    title: t.name,
    posterPath: tmdbPosterUrl(t.poster_path),
    year: t.first_air_date?.slice(0, 4),
    rating: t.vote_average,
    addInput: {
      external_id: String(t.id),
      title: t.name,
      poster_path: t.poster_path,
      synopsis: t.overview || null,
      release_date: t.first_air_date || null,
      external_rating: t.vote_average || null,
    },
  };
}

/** RAWG note sur 5 ; on la ramène sur 10 pour rester cohérent avec l'affichage TMDB ("X.X/10"). */
function normalizeGame(g: RawgGameResult): NormalizedResult {
  const rating = g.rating ? Math.round(g.rating * 2 * 10) / 10 : 0;
  return {
    id: String(g.id),
    title: g.name,
    posterPath: g.background_image,
    year: g.released?.slice(0, 4),
    rating,
    addInput: {
      external_id: String(g.id),
      title: g.name,
      poster_path: g.background_image,
      release_date: g.released || null,
      external_rating: rating || null,
      platforms: [...new Set((g.platforms ?? []).map((p) => p.platform.name))],
    },
  };
}

/**
 * Contenu d'un projet média d'un seul type (film, série ou jeu vidéo — le type est fixé à la
 * création du projet, voir NewProjectDialog). Trois onglets : Nouveautés (alimenté
 * automatiquement via TMDB pour film/série, pas de source pour les jeux), Ma liste (recherche +
 * ajout, ou saisie manuelle pour les jeux), et Vu/Joué (classé par année, avec qui l'a vu/joué).
 * "Où le voir" est récupéré automatiquement (streaming, région France) pour film/série ; pour les
 * jeux, les consoles sont sélectionnées manuellement (pas d'API jeu vidéo configurée).
 */
export function MediaTypeSection({
  projectId,
  type,
  mediaShareToken,
}: {
  projectId: string;
  type: MediaType;
  mediaShareToken: string | null;
}) {
  const labels = MEDIA_TYPE_LABELS[type];
  const isJeu = type === "jeu";
  const autoAvailable = isJeu ? isRawgConfigured() : isTmdbConfigured();
  const { data: items, isLoading } = useMediaItems(projectId, type);
  const { data: linkedPeople } = useProjectPeople(projectId);
  const itemIds = useMemo(() => (items ?? []).map((i) => i.id), [items]);
  const { data: watchers } = useMediaItemWatchers(projectId, itemIds);
  const { data: ratings } = useMediaItemRatings(projectId, itemIds);
  const addTmdb = useAddTmdbMedia(projectId, isJeu ? "film" : (type as "film" | "serie"));
  const addRawg = useAddRawgMedia(projectId);
  const addManual = useAddManualMedia(projectId);
  const toggleWatched = useToggleWatched(projectId);
  const updateItem = useUpdateMediaItem(projectId);
  const deleteItem = useDeleteMediaItem(projectId);
  const setRating = useSetMediaItemRating(projectId);
  const deleteRating = useDeleteMediaItemRating(projectId);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NormalizedResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [trending, setTrending] = useState<NormalizedResult[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [expanded, setExpanded] = useState<MediaItem | null>(null);
  const [consolesTarget, setConsolesTarget] = useState<MediaItem | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualConsoles, setManualConsoles] = useState<Set<string>>(new Set());
  const [pendingWatch, setPendingWatch] = useState<MediaItem | null>(null);
  const [pendingViewers, setPendingViewers] = useState<Set<string>>(new Set());

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
        if (type === "film") setResults((await searchMovies(query)).map(normalizeMovie).slice(0, 8));
        else if (type === "serie") setResults((await searchTvShows(query)).map(normalizeTv).slice(0, 8));
        else setResults((await searchGames(query)).map(normalizeGame).slice(0, 8));
        setSearchError(null);
      } catch (err) {
        setSearchError((err as Error).message);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [query, type, autoAvailable]);

  useEffect(() => {
    if (!autoAvailable) return;
    setTrendingLoading(true);
    (async () => {
      try {
        if (type === "film") setTrending((await trendingMovies()).map(normalizeMovie));
        else if (type === "serie") setTrending((await trendingTvShows()).map(normalizeTv));
        else setTrending((await trendingGames()).map(normalizeGame));
      } catch {
        setTrending([]);
      } finally {
        setTrendingLoading(false);
      }
    })();
  }, [type, autoAvailable]);

  const existingExternalIds = new Set((items ?? []).map((i) => i.external_id));

  async function handleAddResult(result: NormalizedResult) {
    if (isJeu) await addRawg.mutateAsync(result.addInput as RawgAddInput);
    else await addTmdb.mutateAsync(result.addInput as TmdbAddInput);
    setQuery("");
    setResults([]);
  }

  async function handleManualAdd() {
    if (!manualTitle.trim()) return;
    await addManual.mutateAsync({ title: manualTitle.trim(), platforms: [...manualConsoles] });
    setManualTitle("");
    setManualConsoles(new Set());
  }

  function requestToggle(item: MediaItem, checked: boolean) {
    if (!checked) {
      toggleWatched.mutate({ id: item.id, watched: false });
      return;
    }
    setPendingWatch(item);
    setPendingViewers(new Set());
  }

  function confirmWatch() {
    if (!pendingWatch) return;
    toggleWatched.mutate({ id: pendingWatch.id, watched: true, viewerIds: [...pendingViewers] });
    setPendingWatch(null);
  }

  const watcherNamesByItem = new Map<string, string[]>();
  for (const w of watchers ?? []) {
    if (!w.people) continue;
    const list = watcherNamesByItem.get(w.media_item_id) ?? [];
    list.push(w.people.name);
    watcherNamesByItem.set(w.media_item_id, list);
  }

  const notWatched = (items ?? []).filter((i) => !i.watched);
  const watched = (items ?? []).filter((i) => i.watched);
  const watchedByYear = useMemo(() => {
    const map = new Map<string, MediaItem[]>();
    for (const item of watched) {
      const year = (item.watched_at ?? item.created_at).slice(0, 4);
      map.set(year, [...(map.get(year) ?? []), item]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched]);

  const ratingsByItemId = new Map<string, RatingRow[]>();
  for (const r of (ratings ?? []) as RatingRow[]) {
    if (!r.people) continue;
    const list = ratingsByItemId.get(r.media_item_id) ?? [];
    list.push(r);
    ratingsByItemId.set(r.media_item_id, list);
  }

  const currentYear = new Date().getFullYear().toString();
  const ratedEntries = watched
    .map((item) => {
      const list = ratingsByItemId.get(item.id) ?? [];
      if (list.length === 0) return null;
      const avg = list.reduce((sum, r) => sum + r.rating, 0) / list.length;
      const year = (item.watched_at ?? item.created_at).slice(0, 4);
      return { item, avg, year };
    })
    .filter((x): x is { item: MediaItem; avg: number; year: string } => x !== null);
  const ratedThisYear = ratedEntries.filter((e) => e.year === currentYear);
  const bestAllTime = [...ratedEntries].sort((a, b) => b.avg - a.avg).slice(0, 5);
  const worstAllTime = [...ratedEntries].sort((a, b) => a.avg - b.avg).slice(0, 5);
  const bestThisYear = [...ratedThisYear].sort((a, b) => b.avg - a.avg).slice(0, 5);
  const worstThisYear = [...ratedThisYear].sort((a, b) => a.avg - b.avg).slice(0, 5);

  if (!isJeu && !isTmdbConfigured()) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Configuration TMDB manquante — la recherche de {labels.plural.toLowerCase()} n'est pas encore activée.
      </p>
    );
  }

  const Icon = TYPE_ICON[type];

  return (
    <div className="space-y-4">
      <Tabs defaultValue="nouveautes">
        <TabsList>
          <TabsTrigger value="nouveautes">Nouveautés</TabsTrigger>
          <TabsTrigger value="ma-liste">Ma liste ({notWatched.length})</TabsTrigger>
          <TabsTrigger value="vu">
            {labels.watchedLabel} ({watched.length})
          </TabsTrigger>
          <TabsTrigger value="synthese">Synthèse</TabsTrigger>
        </TabsList>

        <TabsContent value="nouveautes" className="pt-3">
          {!autoAvailable ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Pas de source automatique de nouveautés pour les jeux vidéo sans clé RAWG configurée — ajoute-les depuis l'onglet "Ma
              liste".
            </p>
          ) : trendingLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chargement...</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {trending
                .filter((r) => !existingExternalIds.has(r.id))
                .map((r) => (
                  <TrendingCard key={r.id} result={r} type={type} onAdd={() => handleAddResult(r)} />
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ma-liste" className="space-y-3 pt-3">
          {autoAvailable ? (
            <Card>
              <CardContent className="relative p-4">
                <Input
                  placeholder={`Rechercher un(e) ${labels.singular.toLowerCase()} à ajouter...`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {searchError && <p className="mt-2 text-xs text-destructive">{searchError}</p>}
                {(results.length > 0 || searching) && (
                  <div className="absolute inset-x-4 top-[calc(100%-0.5rem)] z-20 max-h-80 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                    {searching && <p className="p-3 text-sm text-muted-foreground">Recherche...</p>}
                    {!searching &&
                      results.map((r) => {
                        const already = existingExternalIds.has(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            disabled={already}
                            onClick={() => handleAddResult(r)}
                            className="flex w-full items-center gap-3 border-b border-border p-2 text-left last:border-0 hover:bg-secondary disabled:opacity-50"
                          >
                            {r.posterPath ? (
                              <img src={r.posterPath} alt="" className="h-14 w-10 flex-shrink-0 rounded object-cover" />
                            ) : (
                              <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded bg-muted">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{r.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {r.year ?? "?"} {already && "· déjà dans la liste"}
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
                <Input placeholder="Titre du jeu" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {CONSOLES.map((c) => (
                    <label key={c} className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs">
                      <Checkbox
                        checked={manualConsoles.has(c)}
                        onCheckedChange={(checked) =>
                          setManualConsoles((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(c);
                            else next.delete(c);
                            return next;
                          })
                        }
                      />
                      {c}
                    </label>
                  ))}
                </div>
                <Button type="button" size="sm" onClick={handleManualAdd} disabled={!manualTitle.trim()}>
                  Ajouter
                </Button>
              </CardContent>
            </Card>
          )}

          {notWatched.length === 0 && !isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Rien en attente.</p>
          ) : (
            <div className="space-y-2">
              {notWatched.map((item) => (
                <MediaRow
                  key={item.id}
                  item={item}
                  type={type}
                  watcherNames={watcherNamesByItem.get(item.id) ?? []}
                  onToggle={(c) => requestToggle(item, c)}
                  onEditConsoles={() => setConsolesTarget(item)}
                  onDelete={() => deleteItem.mutate(item.id)}
                  onOpen={() => setExpanded(item)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="vu" className="space-y-5 pt-3">
          {watchedByYear.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Rien pour l'instant.</p>
          ) : (
            watchedByYear.map(([year, yearItems]) => (
              <div key={year} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {year} ({yearItems.length})
                </p>
                {yearItems.map((item) => (
                  <MediaRow
                    key={item.id}
                    item={item}
                    type={type}
                    watcherNames={watcherNamesByItem.get(item.id) ?? []}
                    onToggle={(c) => requestToggle(item, c)}
                    onEditConsoles={() => setConsolesTarget(item)}
                    onDelete={() => deleteItem.mutate(item.id)}
                    onOpen={() => setExpanded(item)}
                  />
                ))}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="synthese" className="space-y-6 pt-3">
          <MediaShareCard projectId={projectId} shareToken={mediaShareToken} />
          <div className="grid gap-4 sm:grid-cols-2">
            <RankedList title={`Mieux noté(e)s en ${currentYear}`} entries={bestThisYear} />
            <RankedList title={`Moins bien noté(e)s en ${currentYear}`} entries={worstThisYear} />
            <RankedList title="Mieux noté(e)s de tous les temps" entries={bestAllTime} />
            <RankedList title="Moins bien noté(e)s de tous les temps" entries={worstAllTime} />
          </div>
        </TabsContent>
      </Tabs>

      {!isJeu && (
        <p className="text-center text-[0.65rem] text-muted-foreground">
          Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.
        </p>
      )}
      {isJeu && autoAvailable && (
        <p className="text-center text-[0.65rem] text-muted-foreground">Données jeux vidéo fournies par RAWG.io.</p>
      )}

      <Dialog open={!!expanded} onOpenChange={(open) => !open && setExpanded(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          {expanded && (
            <ExpandedMediaDetails
              item={expanded}
              type={type}
              people={linkedPeople ?? []}
              ratings={ratingsByItemId.get(expanded.id) ?? []}
              onSaveRating={(personId, rating, comment) =>
                setRating.mutate({ mediaItemId: expanded.id, personId, rating, comment })
              }
              onDeleteRating={(id) => deleteRating.mutate(id)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!consolesTarget} onOpenChange={(o) => !o && setConsolesTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Sur quelles consoles ?</DialogTitle>
          </DialogHeader>
          {consolesTarget && (
            <ConsolesEditor
              item={consolesTarget}
              onSave={(platforms) => {
                updateItem.mutate({ id: consolesTarget.id, platforms });
                setConsolesTarget(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingWatch} onOpenChange={(o) => !o && setPendingWatch(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Qui l'a {type === "jeu" ? "joué" : "vu"} ?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(linkedPeople ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune personne associée à ce projet (onglet Personnes).</p>
            ) : (
              (linkedPeople ?? []).map((l, i) => (
                <label key={l.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={pendingViewers.has(l.person_id)}
                    onCheckedChange={(checked) =>
                      setPendingViewers((prev) => {
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
          <Button className="w-full" onClick={confirmWatch}>
            Valider
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TrendingCard({ result, type, onAdd }: { result: NormalizedResult; type: MediaType; onAdd: () => void }) {
  const Icon = TYPE_ICON[type];
  return (
    <div className="space-y-1.5 rounded-lg border border-border/60 bg-card p-2">
      {result.posterPath ? (
        <img src={result.posterPath} alt="" className="aspect-[2/3] w-full rounded object-cover" />
      ) : (
        <div className="flex aspect-[2/3] w-full items-center justify-center rounded bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <p className="truncate text-xs font-medium">{result.title}</p>
      <div className="flex items-center justify-between text-[0.65rem] text-muted-foreground">
        <span>{result.year ?? "?"}</span>
        {result.rating > 0 && (
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

function MediaRow({
  item,
  type,
  watcherNames,
  onToggle,
  onEditConsoles,
  onDelete,
  onOpen,
}: {
  item: MediaItem;
  type: MediaType;
  watcherNames: string[];
  onToggle: (watched: boolean) => void;
  onEditConsoles: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const poster = mediaPosterUrl(item);
  const Icon = TYPE_ICON[type];

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-2.5">
      <Checkbox checked={item.watched} onCheckedChange={(c) => onToggle(!!c)} className="flex-shrink-0" />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {poster ? (
          <img src={poster} alt="" className="h-14 w-10 flex-shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn("truncate text-sm font-medium", item.watched && "text-muted-foreground line-through")}>{item.title}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {item.release_date && <span>{item.release_date.slice(0, 4)}</span>}
            {item.external_rating != null && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {item.external_rating.toFixed(1)}
              </span>
            )}
          </div>
          {item.platforms.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.platforms.map((p) => (
                <Badge key={p} variant="secondary" className="text-[0.65rem]">
                  {p}
                </Badge>
              ))}
            </div>
          )}
          {item.watched && watcherNames.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {type === "jeu" ? "Joué par" : "Vu par"} {watcherNames.join(", ")}
            </p>
          )}
        </div>
      </button>
      {type === "jeu" && (
        <Button variant="ghost" size="sm" className="h-8 flex-shrink-0 text-xs" onClick={onEditConsoles}>
          Consoles
        </Button>
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ConsolesEditor({ item, onSave }: { item: MediaItem; onSave: (platforms: string[]) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(item.platforms));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {CONSOLES.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.has(c)}
              onCheckedChange={(checked) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(c);
                  else next.delete(c);
                  return next;
                })
              }
            />
            {c}
          </label>
        ))}
      </div>
      <Button className="w-full" onClick={() => onSave([...selected])}>
        Enregistrer
      </Button>
    </div>
  );
}

function ExpandedMediaDetails({
  item,
  type,
  people,
  ratings,
  onSaveRating,
  onDeleteRating,
}: {
  item: MediaItem;
  type: MediaType;
  people: ProjectPersonRow[];
  ratings: RatingRow[];
  onSaveRating: (personId: string, rating: number, comment: string | null) => void;
  onDeleteRating: (ratingId: string) => void;
}) {
  const poster = mediaPosterUrl(item);
  const Icon = TYPE_ICON[type];
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {poster ? (
          <img src={poster} alt="" className="h-36 w-24 flex-shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-36 w-24 flex-shrink-0 items-center justify-center rounded bg-muted">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="space-y-1">
          <h3 className="font-semibold leading-tight">{item.title}</h3>
          {item.release_date && <p className="text-xs text-muted-foreground">{item.release_date.slice(0, 4)}</p>}
          {item.external_rating != null && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {item.external_rating.toFixed(1)}/10
            </p>
          )}
          {item.platforms.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {item.platforms.map((p) => (
                <Badge key={p} variant="secondary" className="text-[0.65rem]">
                  {p}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      {item.synopsis && <p className="text-sm text-muted-foreground">{item.synopsis}</p>}

      {item.watched && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-semibold">Notes</p>
          <RatingsSection people={people} ratings={ratings} onSave={onSaveRating} onDelete={onDeleteRating} />
        </div>
      )}
    </div>
  );
}

/** Note (/10) + commentaire libre par personne associée au projet — une note par personne et par
 * contenu, modifiable dans le temps (jamais un historique). */
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

/** Lien de partage public de la synthèse (notes/commentaires) — pour diffuser ses recommandations
 * sans donner accès au reste du projet, même principe que le partage du journal de voyage. */
function MediaShareCard({ projectId, shareToken }: { projectId: string; shareToken: string | null }) {
  const setShareToken = useSetMediaShareToken(projectId);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareToken ? `${APP_URL}/media/${shareToken}` : null;

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-accent/40 bg-gradient-to-br from-accent/10 to-transparent">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Share2 className="h-4 w-4 text-accent" />
          <div>
            <p className="text-sm font-semibold">Partage public</p>
            <p className="text-xs text-muted-foreground">
              {shareUrl
                ? "Visible par toute personne ayant ce lien, sans compte."
                : "Non partagé — partage ce lien pour diffuser tes recommandations."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {shareUrl && (
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : null}
              {copied ? "Copié" : "Copier le lien"}
            </Button>
          )}
          <Button
            variant={shareUrl ? "outline" : "default"}
            size="sm"
            onClick={() => setShareToken.mutate(!shareUrl)}
            disabled={setShareToken.isPending}
          >
            {shareUrl ? "Désactiver" : "Activer le partage"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RankedList({ title, entries }: { title: string; entries: { item: MediaItem; avg: number }[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Rien pour l'instant.</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map(({ item, avg }) => {
            const poster = mediaPosterUrl(item);
            return (
              <div key={item.id} className="flex items-center gap-2 rounded-md border border-border/60 bg-card p-2">
                {poster ? (
                  <img src={poster} alt="" className="h-10 w-7 flex-shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-10 w-7 flex-shrink-0 rounded bg-muted" />
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                <span className="flex flex-shrink-0 items-center gap-1 text-sm font-medium">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {avg.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

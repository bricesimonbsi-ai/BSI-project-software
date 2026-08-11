import { useEffect, useMemo, useState } from "react";
import { searchMovies, tmdbPosterUrl, isTmdbConfigured, type TmdbMovieResult } from "@/features/media/tmdb";
import { useMediaItems, useAddMovie, useToggleWatched, useUpdateMediaItem, useDeleteMediaItem } from "@/features/media/use-media-list";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Star, Trash2, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/types/database";

export function FilmsTab({ projectId }: { projectId: string }) {
  const { data: items, isLoading } = useMediaItems(projectId, "film");
  const addMovie = useAddMovie(projectId);
  const toggleWatched = useToggleWatched(projectId);
  const updateItem = useUpdateMediaItem(projectId);
  const deleteItem = useDeleteMediaItem(projectId);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbMovieResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<MediaItem | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await searchMovies(query);
        setResults(res.slice(0, 8));
        setSearchError(null);
      } catch (err) {
        setSearchError((err as Error).message);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [query]);

  const existingExternalIds = new Set((items ?? []).map((i) => i.external_id));

  async function handleAdd(movie: TmdbMovieResult) {
    await addMovie.mutateAsync(movie);
    setQuery("");
    setResults([]);
  }

  if (!isTmdbConfigured()) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Configuration TMDB manquante — la recherche de films n'est pas encore activée.
      </p>
    );
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
  }, [watched]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="relative p-4">
          <Input
            placeholder="Rechercher un film à ajouter..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {searchError && <p className="mt-2 text-xs text-destructive">{searchError}</p>}
          {(results.length > 0 || searching) && (
            <div className="absolute inset-x-4 top-[calc(100%-0.5rem)] z-20 max-h-80 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
              {searching && <p className="p-3 text-sm text-muted-foreground">Recherche...</p>}
              {!searching &&
                results.map((movie) => {
                  const already = existingExternalIds.has(String(movie.id));
                  const poster = tmdbPosterUrl(movie.poster_path);
                  return (
                    <button
                      key={movie.id}
                      type="button"
                      disabled={already}
                      onClick={() => handleAdd(movie)}
                      className="flex w-full items-center gap-3 border-b border-border p-2 text-left last:border-0 hover:bg-secondary disabled:opacity-50"
                    >
                      {poster ? (
                        <img src={poster} alt="" className="h-14 w-10 flex-shrink-0 rounded object-cover" />
                      ) : (
                        <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded bg-muted">
                          <Film className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{movie.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {movie.release_date?.slice(0, 4) ?? "?"} {already && "· déjà dans la liste"}
                        </p>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {(items ?? []).length === 0 && !isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Aucun film pour l'instant — recherche-en un ci-dessus.</p>
      ) : (
        <Tabs defaultValue="a-voir">
          <TabsList>
            <TabsTrigger value="a-voir">À voir ({notWatched.length})</TabsTrigger>
            <TabsTrigger value="vus">Vus ({watched.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="a-voir" className="space-y-2 pt-3">
            {notWatched.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Rien en attente — recherche un film à ajouter.</p>
            ) : (
              notWatched.map((item) => (
                <FilmRow
                  key={item.id}
                  item={item}
                  onToggle={(watched) => toggleWatched.mutate({ id: item.id, watched })}
                  onPlatformChange={(platform) => updateItem.mutate({ id: item.id, platform: platform || null })}
                  onDelete={() => deleteItem.mutate(item.id)}
                  onOpen={() => setExpanded(item)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="vus" className="space-y-5 pt-3">
            {watchedByYear.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aucun film vu pour l'instant.</p>
            ) : (
              watchedByYear.map(([year, yearItems]) => (
                <div key={year} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {year} ({yearItems.length})
                  </p>
                  {yearItems.map((item) => (
                    <FilmRow
                      key={item.id}
                      item={item}
                      onToggle={(watched) => toggleWatched.mutate({ id: item.id, watched })}
                      onPlatformChange={(platform) => updateItem.mutate({ id: item.id, platform: platform || null })}
                      onDelete={() => deleteItem.mutate(item.id)}
                      onOpen={() => setExpanded(item)}
                    />
                  ))}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      <p className="text-center text-[0.65rem] text-muted-foreground">
        Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.
      </p>

      <Dialog open={!!expanded} onOpenChange={(open) => !open && setExpanded(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          {expanded && (
            <div className="space-y-3">
              <div className="flex gap-3">
                {tmdbPosterUrl(expanded.poster_path) ? (
                  <img src={tmdbPosterUrl(expanded.poster_path)!} alt="" className="h-36 w-24 flex-shrink-0 rounded object-cover" />
                ) : (
                  <div className="flex h-36 w-24 flex-shrink-0 items-center justify-center rounded bg-muted">
                    <Film className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="space-y-1">
                  <h3 className="font-semibold leading-tight">{expanded.title}</h3>
                  <p className="text-xs text-muted-foreground">{expanded.release_date?.slice(0, 4)}</p>
                  {expanded.external_rating != null && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {expanded.external_rating.toFixed(1)}/10
                    </p>
                  )}
                </div>
              </div>
              {expanded.synopsis && <p className="text-sm text-muted-foreground">{expanded.synopsis}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilmRow({
  item,
  onToggle,
  onPlatformChange,
  onDelete,
  onOpen,
}: {
  item: MediaItem;
  onToggle: (watched: boolean) => void;
  onPlatformChange: (platform: string) => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const [platform, setPlatform] = useState(item.platform ?? "");
  const poster = tmdbPosterUrl(item.poster_path);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-2.5">
      <Checkbox checked={item.watched} onCheckedChange={(c) => onToggle(!!c)} className="flex-shrink-0" />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {poster ? (
          <img src={poster} alt="" className="h-14 w-10 flex-shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded bg-muted">
            <Film className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-medium", item.watched && "text-muted-foreground line-through")}>{item.title}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {item.release_date && <span>{item.release_date.slice(0, 4)}</span>}
            {item.external_rating != null && (
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {item.external_rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </button>
      <Input
        value={platform}
        onChange={(e) => setPlatform(e.target.value)}
        onBlur={() => platform !== (item.platform ?? "") && onPlatformChange(platform)}
        placeholder="Où le voir"
        className="h-8 w-28 flex-shrink-0 text-xs"
      />
      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

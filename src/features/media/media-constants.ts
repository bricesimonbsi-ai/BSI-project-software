import { tmdbPosterUrl } from "@/features/media/tmdb";
import type { MediaItem, MediaType } from "@/types/database";

/** Liste fixe de consoles/plateformes de jeu, choisies manuellement (pas de source automatique
 * pour les jeux — TMDB ne couvre pas le jeu vidéo). */
export const CONSOLES = ["PS5", "PS4", "Xbox Series X|S", "Xbox One", "Nintendo Switch", "PC", "Mobile"];

export const MEDIA_TYPE_LABELS: Record<MediaType, { singular: string; plural: string; icon: string; watchedLabel: string }> = {
  film: { singular: "Film", plural: "Films", icon: "🎬", watchedLabel: "Vus" },
  serie: { singular: "Série", plural: "Séries", icon: "📺", watchedLabel: "Vues" },
  jeu: { singular: "Jeu vidéo", plural: "Jeux vidéo", icon: "🎮", watchedLabel: "Joués" },
};

/** Suggestions pour l'éditeur de genres (TagEditor) d'un film/série — les genres TMDB fr-FR
 * usuels ; l'utilisateur peut toujours en ajouter d'autres librement. */
export const SUGGESTED_MEDIA_GENRES = [
  "Action",
  "Animation",
  "Aventure",
  "Comédie",
  "Crime",
  "Documentaire",
  "Drame",
  "Familial",
  "Fantastique",
  "Guerre",
  "Histoire",
  "Horreur",
  "Musique",
  "Mystère",
  "Romance",
  "Science-Fiction",
  "Thriller",
  "Western",
];

/** URL d'affiche affichable, selon la source de la donnée : `poster_path` stocke un simple
 * fragment de chemin pour un film/série TMDB (à préfixer), mais une URL déjà absolue pour un jeu
 * RAWG (`background_image`, jamais préfixée). */
export function mediaPosterUrl(item: Pick<MediaItem, "type" | "poster_path">): string | null {
  if (!item.poster_path) return null;
  return item.type === "jeu" ? item.poster_path : tmdbPosterUrl(item.poster_path);
}

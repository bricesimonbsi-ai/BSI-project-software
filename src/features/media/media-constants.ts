import type { MediaType } from "@/types/database";

/** Liste fixe de consoles/plateformes de jeu, choisies manuellement (pas de source automatique
 * pour les jeux — TMDB ne couvre pas le jeu vidéo). */
export const CONSOLES = ["PS5", "PS4", "Xbox Series X|S", "Xbox One", "Nintendo Switch", "PC", "Mobile"];

export const MEDIA_TYPE_LABELS: Record<MediaType, { singular: string; plural: string; icon: string; watchedLabel: string }> = {
  film: { singular: "Film", plural: "Films", icon: "🎬", watchedLabel: "Vus" },
  serie: { singular: "Série", plural: "Séries", icon: "📺", watchedLabel: "Vues" },
  jeu: { singular: "Jeu vidéo", plural: "Jeux vidéo", icon: "🎮", watchedLabel: "Joués" },
};

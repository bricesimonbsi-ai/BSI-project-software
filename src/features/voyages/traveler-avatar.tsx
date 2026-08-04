import { cn } from "@/lib/utils";

/** Palette cyclique, une couleur par voyageur selon sa position (pas de choix manuel à faire). */
const AVATAR_COLOR_CLASSES = [
  "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  "bg-sky-500/20 text-sky-700 dark:text-sky-300",
  "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  "bg-violet-500/20 text-violet-700 dark:text-violet-300",
  "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
];

/** Émojis suggérés pour un avatar de voyageur, sans forcer une saisie. */
export const TRAVELER_EMOJI_SUGGESTIONS = ["🧑", "👩", "👨", "🧒", "👵", "👴", "🧑‍🦱", "👩‍🦰", "🧔", "👶"];

/** Avatar rond : émoji choisi, ou à défaut l'initiale du nom sur un fond coloré cyclique. */
export function TravelerAvatarBadge({
  name,
  avatarEmoji,
  index,
  className,
}: {
  name: string;
  avatarEmoji?: string | null;
  index: number;
  className?: string;
}) {
  const colorClass = AVATAR_COLOR_CLASSES[index % AVATAR_COLOR_CLASSES.length];
  return (
    <span
      className={cn("flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold", colorClass, className)}
      title={name}
    >
      {avatarEmoji || name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { generateAvatarDataUri } from "@/features/people/avatar-generator";
import type { PersonAvatarConfig } from "@/types/database";

/** Palette cyclique, une couleur par personne selon sa position (pas de choix manuel à faire) —
 * exportée pour que d'autres vues (ex. l'agenda) dérivent une couleur stable par personne à
 * partir du même index de position que celui utilisé ici pour l'avatar. */
export const AVATAR_COLOR_CLASSES = [
  "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  "bg-sky-500/20 text-sky-700 dark:text-sky-300",
  "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  "bg-violet-500/20 text-violet-700 dark:text-violet-300",
  "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
];

/** Même palette que AVATAR_COLOR_CLASSES (teintes alignées par index), en couleur pleine — pour
 * une simple pastille (ex. puce d'événement d'agenda) plutôt qu'un badge avatar. */
export const AVATAR_DOT_CLASSES = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
];

/** Émojis suggérés pour un avatar de personne, sans forcer une saisie. */
export const PERSON_EMOJI_SUGGESTIONS = ["🧑", "👩", "👨", "🧒", "👵", "👴", "🧑‍🦱", "👩‍🦰", "🧔", "👶"];

/** Avatar rond : avatar personnalisé (DiceBear) si configuré, sinon émoji choisi, sinon
 * l'initiale du nom sur un fond coloré cyclique. */
export function PersonAvatarBadge({
  name,
  avatarEmoji,
  avatarConfig,
  personId,
  index,
  colorIndex,
  className,
}: {
  name: string;
  avatarEmoji?: string | null;
  avatarConfig?: PersonAvatarConfig | null;
  personId?: string;
  index: number;
  /** Couleur manuelle (Person.color_index) — prioritaire sur `index` quand fournie et non nulle,
   * pour que la couleur d'une personne reste la même partout, pas seulement dérivée de sa
   * position dans la liste affichée à cet endroit précis. */
  colorIndex?: number | null;
  className?: string;
}) {
  const colorClass = AVATAR_COLOR_CLASSES[(colorIndex ?? index) % AVATAR_COLOR_CLASSES.length];
  const dataUri = useMemo(() => {
    if (!avatarConfig) return null;
    return generateAvatarDataUri(personId ?? name, avatarConfig);
  }, [avatarConfig, personId, name]);

  if (dataUri) {
    return (
      <span className={cn("flex h-7 w-7 flex-shrink-0 overflow-hidden rounded-full bg-muted", className)} title={name}>
        <img src={dataUri} alt={name} className="h-full w-full" />
      </span>
    );
  }

  return (
    <span
      className={cn("flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold", colorClass, className)}
      title={name}
    >
      {avatarEmoji || name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

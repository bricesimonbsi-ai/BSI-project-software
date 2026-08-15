import { AVATAR_COLOR_CLASSES, AVATAR_DOT_CLASSES } from "@/features/people/person-avatar";
import type { Person } from "@/types/database";

/** Position stable d'une personne dans le répertoire (trié par order_index, comme usePeople()) —
 * pour une couleur identique partout dans l'agenda (légende, sélecteur, puces du calendrier),
 * contrairement à PersonAvatarBadge dont l'index est positionnel au contexte d'affichage. */
export function personColorIndex(personId: string, allPeople: Person[]): number {
  const i = allPeople.findIndex((p) => p.id === personId);
  return i < 0 ? 0 : i % AVATAR_COLOR_CLASSES.length;
}

export function personBadgeColorClass(personId: string, allPeople: Person[]): string {
  return AVATAR_COLOR_CLASSES[personColorIndex(personId, allPeople)];
}

export function personDotColorClass(personId: string, allPeople: Person[]): string {
  return AVATAR_DOT_CLASSES[personColorIndex(personId, allPeople)];
}

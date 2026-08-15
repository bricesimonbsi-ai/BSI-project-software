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

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Couleur par COMBINAISON de participants (pas juste le premier) : Brice seul, Marine seule et
 * "Brice & Marine" ont chacun leur propre couleur stable. Un seul participant garde sa couleur
 * individuelle (personColorIndex) ; plusieurs participants dérivent une couleur du hash de
 * l'ensemble trié (même ensemble = même couleur, quel que soit l'ordre). */
export function combinationColorIndex(personIds: string[], allPeople: Person[]): number {
  if (personIds.length === 0) return 0;
  if (personIds.length === 1) return personColorIndex(personIds[0], allPeople);
  const key = [...personIds].sort().join(",");
  return hashString(key) % AVATAR_COLOR_CLASSES.length;
}

export function combinationDotColorClass(personIds: string[], allPeople: Person[]): string {
  return AVATAR_DOT_CLASSES[combinationColorIndex(personIds, allPeople)];
}

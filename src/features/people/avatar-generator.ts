import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";
import type { PersonAvatarConfig } from "@/types/database";

/** Palettes et options DiceBear (style "avataaars") exposées au picker. Générées 100% côté
 * client, aucun appel réseau — cf. schema.js de @dicebear/avataaars pour les valeurs sources. */
export const AVATAR_SKIN_COLORS = ["614335", "ae5d29", "d08b5b", "edb98a", "ffdbb4", "fd9841", "f8d25c"];

export const AVATAR_HAIR_COLORS = [
  "2c1b18",
  "4a312c",
  "724133",
  "a55728",
  "b58143",
  "d6b370",
  "ecdcbf",
  "e8e1e1",
  "f59797",
  "c93305",
];

export const AVATAR_HAIRSTYLES: { value: string; label: string }[] = [
  { value: "shortFlat", label: "Courts plats" },
  { value: "shortRound", label: "Courts ronds" },
  { value: "shortWaved", label: "Courts ondulés" },
  { value: "shortCurly", label: "Courts bouclés" },
  { value: "sides", label: "Rasé sur les côtés" },
  { value: "shavedSides", label: "Tempes rasées" },
  { value: "theCaesar", label: "César" },
  { value: "theCaesarAndSidePart", label: "César raie sur le côté" },
  { value: "straight01", label: "Longs raides" },
  { value: "straight02", label: "Longs raides (2)" },
  { value: "straightAndStrand", label: "Longs raides à mèche" },
  { value: "longButNotTooLong", label: "Mi-longs" },
  { value: "bob", label: "Carré" },
  { value: "bun", label: "Chignon" },
  { value: "curly", label: "Bouclés" },
  { value: "curvy", label: "Ondulés volumineux" },
  { value: "bigHair", label: "Volumineux" },
  { value: "fro", label: "Afro" },
  { value: "froBand", label: "Afro avec bandeau" },
  { value: "dreads", label: "Dreadlocks" },
  { value: "dreads01", label: "Dreadlocks (2)" },
  { value: "dreads02", label: "Dreadlocks (3)" },
  { value: "frizzle", label: "Frisottés" },
  { value: "shaggy", label: "Ébouriffés" },
  { value: "shaggyMullet", label: "Mulet ébouriffé" },
  { value: "miaWallace", label: "Carré Mia Wallace" },
  { value: "frida", label: "Frida" },
  { value: "hat", label: "Casquette" },
  { value: "hijab", label: "Hijab" },
  { value: "turban", label: "Turban" },
  { value: "winterHat1", label: "Bonnet d'hiver" },
  { value: "winterHat02", label: "Bonnet d'hiver (2)" },
  { value: "winterHat03", label: "Bonnet d'hiver (3)" },
  { value: "winterHat04", label: "Bonnet d'hiver (4)" },
];

export const AVATAR_ACCESSORIES: { value: string; label: string }[] = [
  { value: "round", label: "Lunettes rondes" },
  { value: "wayfarers", label: "Lunettes wayfarer" },
  { value: "prescription01", label: "Lunettes de vue" },
  { value: "prescription02", label: "Lunettes de vue (2)" },
  { value: "kurt", label: "Lunettes Kurt" },
  { value: "sunglasses", label: "Lunettes de soleil" },
  { value: "eyepatch", label: "Cache-œil" },
];

export const DEFAULT_AVATAR_CONFIG: PersonAvatarConfig = {
  skinColor: AVATAR_SKIN_COLORS[3],
  hairColor: AVATAR_HAIR_COLORS[0],
  top: "shortFlat",
  accessories: null,
};

/** Rendu déterministe : mêmes couleurs/coiffure/accessoire choisis par l'utilisateur, mais les
 * traits non exposés dans le picker (yeux, bouche, vêtements...) restent stables d'un rendu à
 * l'autre grâce au seed (id de la personne) plutôt que de re-tirer au hasard à chaque appel. */
export function generateAvatarDataUri(seed: string, config: PersonAvatarConfig): string {
  const avatar = createAvatar(avataaars, {
    seed,
    size: 128,
    skinColor: [config.skinColor],
    hairColor: [config.hairColor],
    top: [config.top as never],
    accessories: config.accessories ? [config.accessories as never] : [],
    accessoriesProbability: config.accessories ? 100 : 0,
  });
  return avatar.toDataUri();
}

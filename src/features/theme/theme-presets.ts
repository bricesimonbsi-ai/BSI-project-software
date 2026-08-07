export type ThemePresetId = "ocean" | "emeraude" | "violet" | "corail" | "rose" | "ambre";

export interface ThemePresetColors {
  /** Triplet HSL sans fonction ("H S% L%"), au format attendu par les variables CSS --primary/--accent/--ring. */
  primary: string;
  accent: string;
  ring: string;
}

export interface ThemePreset {
  id: ThemePresetId;
  label: string;
  /** Couleur hex utilisée pour l'aperçu (pastille) dans le sélecteur de thème. */
  swatch: string;
  light: ThemePresetColors;
  dark: ThemePresetColors;
}

/** Thèmes de couleur sélectionnables pour toute l'application (indépendants du mode clair/sombre
 * et de l'accent contextuel par catégorie, qui reste prioritaire sur --accent quand actif). */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "ocean",
    label: "Océan",
    swatch: "#0ea5e9",
    light: { primary: "222 89% 55%", accent: "199 89% 48%", ring: "222 89% 55%" },
    dark: { primary: "199 89% 58%", accent: "199 89% 58%", ring: "199 89% 58%" },
  },
  {
    id: "emeraude",
    label: "Émeraude",
    swatch: "#10b981",
    light: { primary: "160 84% 39%", accent: "158 64% 42%", ring: "160 84% 39%" },
    dark: { primary: "158 64% 52%", accent: "158 64% 52%", ring: "158 64% 52%" },
  },
  {
    id: "violet",
    label: "Violet",
    swatch: "#8b5cf6",
    light: { primary: "262 83% 58%", accent: "270 91% 65%", ring: "262 83% 58%" },
    dark: { primary: "263 70% 66%", accent: "263 70% 66%", ring: "263 70% 66%" },
  },
  {
    id: "corail",
    label: "Corail",
    swatch: "#f97316",
    light: { primary: "16 90% 50%", accent: "24 95% 50%", ring: "16 90% 50%" },
    dark: { primary: "20 90% 62%", accent: "20 90% 62%", ring: "20 90% 62%" },
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "#ec4899",
    light: { primary: "330 81% 50%", accent: "336 80% 53%", ring: "330 81% 50%" },
    dark: { primary: "330 81% 65%", accent: "330 81% 65%", ring: "330 81% 65%" },
  },
  {
    id: "ambre",
    label: "Ambre",
    swatch: "#f59e0b",
    light: { primary: "38 92% 42%", accent: "43 96% 40%", ring: "38 92% 42%" },
    dark: { primary: "43 96% 58%", accent: "43 96% 58%", ring: "43 96% 58%" },
  },
];

export function getThemePreset(id: ThemePresetId): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

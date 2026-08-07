export type ThemePresetId = "ocean" | "emeraude" | "violet" | "corail" | "rose" | "ambre" | "citron" | "sport" | "nature" | "nuit";

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
  {
    id: "citron",
    label: "Tarte au citron",
    swatch: "#eab308",
    light: { primary: "50 92% 42%", accent: "45 96% 40%", ring: "50 92% 42%" },
    dark: { primary: "48 96% 58%", accent: "48 96% 58%", ring: "48 96% 58%" },
  },
  {
    id: "sport",
    label: "Sport",
    swatch: "#e11d48",
    light: { primary: "355 85% 50%", accent: "5 90% 50%", ring: "355 85% 50%" },
    dark: { primary: "355 85% 64%", accent: "355 85% 64%", ring: "355 85% 64%" },
  },
  {
    id: "nature",
    label: "Nature",
    swatch: "#4d7c0f",
    light: { primary: "95 50% 32%", accent: "100 45% 36%", ring: "95 50% 32%" },
    dark: { primary: "95 45% 56%", accent: "95 45% 56%", ring: "95 45% 56%" },
  },
  {
    id: "nuit",
    label: "Nuit",
    swatch: "#4f46e5",
    light: { primary: "243 75% 59%", accent: "250 80% 62%", ring: "243 75% 59%" },
    dark: { primary: "243 75% 68%", accent: "243 75% 68%", ring: "243 75% 68%" },
  },
];

export function getThemePreset(id: ThemePresetId): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

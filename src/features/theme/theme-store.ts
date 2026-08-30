import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemePresetId } from "@/features/theme/theme-presets";

export type ThemeMode = "light" | "dark" | "system";

/** Disposition de la liste des catégories sur la page d'accueil, réglable dans Réglages. */
export type CategoryLayout = "list" | "grid" | "circle" | "orbital";

/** Traitement de couleur des catégories dans la disposition "Orbital" : une seule teinte violette,
 * ou un dégradé froid violet → cyan selon la position — cf. la couleur de chaque catégorie prise
 * telle quelle, jugée trop bigarrée en anneau. */
export type OrbitalAccent = "mono" | "duo";

interface ThemeState {
  mode: ThemeMode;
  themePreset: ThemePresetId;
  categoryLayout: CategoryLayout;
  orbitalAccent: OrbitalAccent;
  accentColor: string | null; // couleur d'accent contextuelle (ex. catégorie active), hex — prioritaire sur le thème
  setMode: (mode: ThemeMode) => void;
  setThemePreset: (preset: ThemePresetId) => void;
  setCategoryLayout: (layout: CategoryLayout) => void;
  setOrbitalAccent: (accent: OrbitalAccent) => void;
  setAccentColor: (color: string | null) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "dark",
      themePreset: "nuit",
      categoryLayout: "list",
      orbitalAccent: "duo",
      accentColor: null,
      setMode: (mode) => set({ mode }),
      setThemePreset: (themePreset) => set({ themePreset }),
      setCategoryLayout: (categoryLayout) => set({ categoryLayout }),
      setOrbitalAccent: (orbitalAccent) => set({ orbitalAccent }),
      setAccentColor: (accentColor) => set({ accentColor }),
    }),
    { name: "portefeuille-projets-theme" }
  )
);

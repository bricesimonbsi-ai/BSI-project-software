import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemePresetId } from "@/features/theme/theme-presets";

export type ThemeMode = "light" | "dark" | "system";

/** Disposition de la liste des catégories sur la page d'accueil, réglable dans Réglages. */
export type CategoryLayout = "list" | "grid" | "circle";

interface ThemeState {
  mode: ThemeMode;
  themePreset: ThemePresetId;
  categoryLayout: CategoryLayout;
  accentColor: string | null; // couleur d'accent contextuelle (ex. catégorie active), hex — prioritaire sur le thème
  setMode: (mode: ThemeMode) => void;
  setThemePreset: (preset: ThemePresetId) => void;
  setCategoryLayout: (layout: CategoryLayout) => void;
  setAccentColor: (color: string | null) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "dark",
      themePreset: "nuit",
      categoryLayout: "list",
      accentColor: null,
      setMode: (mode) => set({ mode }),
      setThemePreset: (themePreset) => set({ themePreset }),
      setCategoryLayout: (categoryLayout) => set({ categoryLayout }),
      setAccentColor: (accentColor) => set({ accentColor }),
    }),
    { name: "portefeuille-projets-theme" }
  )
);

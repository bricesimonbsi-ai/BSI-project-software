import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemePresetId } from "@/features/theme/theme-presets";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  themePreset: ThemePresetId;
  accentColor: string | null; // couleur d'accent contextuelle (ex. catégorie active), hex — prioritaire sur le thème
  setMode: (mode: ThemeMode) => void;
  setThemePreset: (preset: ThemePresetId) => void;
  setAccentColor: (color: string | null) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      themePreset: "ocean",
      accentColor: null,
      setMode: (mode) => set({ mode }),
      setThemePreset: (themePreset) => set({ themePreset }),
      setAccentColor: (accentColor) => set({ accentColor }),
    }),
    { name: "portefeuille-projets-theme" }
  )
);

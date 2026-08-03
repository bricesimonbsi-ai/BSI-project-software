import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  accentColor: string | null; // couleur d'accent contextuelle (ex. catégorie active), hex
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: string | null) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      accentColor: null,
      setMode: (mode) => set({ mode }),
      setAccentColor: (accentColor) => set({ accentColor }),
    }),
    { name: "portefeuille-projets-theme" }
  )
);

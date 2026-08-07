import { useEffect, useState, type ReactNode } from "react";
import { useThemeStore } from "@/features/theme/theme-store";
import { getThemePreset } from "@/features/theme/theme-presets";
import { hexToHslTriplet } from "@/lib/utils";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const themePreset = useThemeStore((s) => s.themePreset);
  const accentColor = useThemeStore((s) => s.accentColor);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const applyDark = (dark: boolean) => {
      root.classList.toggle("dark", dark);
      setIsDark(dark);
    };

    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      applyDark(mq.matches);
      const listener = (e: MediaQueryListEvent) => applyDark(e.matches);
      mq.addEventListener("change", listener);
      return () => mq.removeEventListener("change", listener);
    }
    applyDark(mode === "dark");
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    const preset = getThemePreset(themePreset);
    const colors = isDark ? preset.dark : preset.light;
    root.style.setProperty("--primary", colors.primary);
    root.style.setProperty("--ring", colors.ring);
    // La couleur de la catégorie consultée (accentColor), quand définie, reste prioritaire sur
    // l'accent du thème choisi — comportement inchangé depuis avant l'ajout des thèmes.
    root.style.setProperty("--accent", accentColor ? hexToHslTriplet(accentColor) : colors.accent);
  }, [themePreset, isDark, accentColor]);

  return <>{children}</>;
}

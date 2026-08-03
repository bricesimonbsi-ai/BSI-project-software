import { useEffect, type ReactNode } from "react";
import { useThemeStore } from "@/features/theme/theme-store";
import { hexToHslTriplet } from "@/lib/utils";

const DEFAULT_ACCENT_HSL = "199 89% 48%";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const accentColor = useThemeStore((s) => s.accentColor);

  useEffect(() => {
    const root = document.documentElement;
    const applyDark = (isDark: boolean) => root.classList.toggle("dark", isDark);

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
    const triplet = accentColor ? hexToHslTriplet(accentColor) : DEFAULT_ACCENT_HSL;
    root.style.setProperty("--accent", triplet);
  }, [accentColor]);

  return <>{children}</>;
}

import { useThemeStore } from "@/features/theme/theme-store";
import { getThemePreset } from "@/features/theme/theme-presets";

interface MotifSlot {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  size: string;
  rotate: number;
  delay: string;
}

/** Positions/tailles/délais fixes (pas de random à chaque rendu) pour un effet "qui flotte"
 * stable plutôt que des emoji qui sautent d'un endroit à l'autre à chaque re-render. */
const SLOTS: MotifSlot[] = [
  { top: "6%", left: "4%", size: "3.25rem", rotate: -12, delay: "0s" },
  { top: "14%", right: "7%", size: "2.5rem", rotate: 10, delay: "1.3s" },
  { top: "44%", left: "2%", size: "2.25rem", rotate: 6, delay: "2.6s" },
  { top: "70%", right: "3%", size: "2.75rem", rotate: -8, delay: "0.7s" },
  { bottom: "8%", left: "9%", size: "2.25rem", rotate: 14, delay: "1.9s" },
  { bottom: "16%", right: "16%", size: "2rem", rotate: -6, delay: "3.2s" },
];

/** Emoji du thème actif qui flottent doucement en filigrane, en fond de toute l'application —
 * réservé aux thèmes "poussés" (motifEmojis défini) ; ne s'affiche pas pour les thèmes de
 * couleur simples. Purement décoratif : aria-hidden, pointer-events désactivés, jamais au-dessus
 * du contenu (-z-10). */
export function ThemeMotifBackground() {
  const themePreset = useThemeStore((s) => s.themePreset);
  const preset = getThemePreset(themePreset);
  const motifs = preset.motifEmojis;

  if (!motifs || motifs.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {SLOTS.map((slot, i) => (
        <span
          key={i}
          className="theme-motif absolute select-none opacity-[0.08] dark:opacity-[0.12]"
          style={{
            top: slot.top,
            left: slot.left,
            right: slot.right,
            bottom: slot.bottom,
            fontSize: slot.size,
            rotate: `${slot.rotate}deg`,
            animationDelay: slot.delay,
          }}
        >
          {motifs[i % motifs.length]}
        </span>
      ))}
    </div>
  );
}

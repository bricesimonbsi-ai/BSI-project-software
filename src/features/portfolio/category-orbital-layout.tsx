import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Shapes } from "lucide-react";
import type { OrbitalAccent } from "@/features/theme/theme-store";
import type { CategoryStat } from "@/features/portfolio/portfolio-home";

// Deux traitements de couleur pour les nœuds, choisis par l'utilisateur en Réglages après avoir
// comparé plusieurs pistes : la couleur propre à chaque catégorie en anneau complet (façon
// CategoryCircleLayout) a été jugée trop bigarrée dans ce contexte. Volontairement fixes (pas
// dérivés des tokens --accent/--primary du thème courant) : même logique que
// `stat.category.color` déjà utilisé tel quel dans CategoryCircleLayout, indépendamment du thème.
const MONO_VIOLET = "#8b6bf2";
const DUO_FROM = "#4c3494";
const DUO_TO = "#4dd0e1";

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function lerpColor(a: string, b: string, t: number) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t);
}

export function orbitalNodeColor(index: number, total: number, accentStyle: OrbitalAccent): string {
  if (accentStyle === "mono") return MONO_VIOLET;
  return lerpColor(DUO_FROM, DUO_TO, total > 1 ? index / (total - 1) : 0);
}

function greeting(name: string | null | undefined) {
  const hour = new Date().getHours();
  const time = hour >= 18 || hour < 5 ? "Bonsoir" : "Bonjour";
  return name ? `${time}, ${name}` : time;
}

/** Anneau animé décoratif derrière la salutation + les catégories disposées en orbite autour —
 * canvas plutôt que SVG pour l'animation continue (cf. skill artifact-diagramming), respecte
 * prefers-reduced-motion (dessine une seule frame statique, pas de boucle). */
function OrbitalRingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !wrap || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let t = Math.random() * 10;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = wrap!.clientWidth * dpr;
      canvas!.height = wrap!.clientHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      ctx!.clearRect(0, 0, w, h);

      [0.3, 0.42, 0.48].forEach((r, i) => {
        ctx!.beginPath();
        ctx!.arc(cx, cy, w * r, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(139,107,242,${0.16 - i * 0.03})`;
        ctx!.lineWidth = 1;
        ctx!.stroke();
      });

      for (let i = 0; i < 3; i++) {
        const a = t * (0.15 + i * 0.05) + (i * Math.PI * 2) / 3;
        const r = w * (0.3 + i * 0.06);
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        ctx!.beginPath();
        ctx!.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(201,189,251,0.85)";
        ctx!.shadowColor = "rgba(139,107,242,0.9)";
        ctx!.shadowBlur = 8;
        ctx!.fill();
        ctx!.shadowBlur = 0;
      }

      if (!reduceMotion) {
        t += 0.006;
        raf = requestAnimationFrame(draw);
      }
    }
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

interface CategoryOrbitalLayoutProps {
  stats: CategoryStat[];
  accentStyle: OrbitalAccent;
  greetingName: string | null | undefined;
}

export function CategoryOrbitalLayout({ stats, accentStyle, greetingName }: CategoryOrbitalLayoutProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="relative aspect-square w-full max-w-[420px]">
        <OrbitalRingCanvas />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <span
            aria-hidden="true"
            className="h-9 w-9 rounded-full"
            style={{ background: "conic-gradient(from 210deg, #c9bdfb, #7c5cf0, #c9bdfb)", boxShadow: "0 0 30px rgba(124,92,240,.5)" }}
          />
          <p className="text-lg font-semibold">{greeting(greetingName)}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {stats.map((stat, i) => {
          const angle = (Math.PI * 2 * i) / stats.length - Math.PI / 2;
          const c = orbitalNodeColor(i, stats.length, accentStyle);
          return (
            <Link
              key={stat.category.id}
              to={`/categories/${stat.category.id}`}
              className="group absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 text-center"
              style={{ left: `${50 + 42 * Math.cos(angle)}%`, top: `${50 + 42 * Math.sin(angle)}%` }}
            >
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-sm transition-transform group-hover:scale-105"
                style={{ backgroundColor: `${c}22`, border: `1.5px solid ${c}99`, boxShadow: `0 0 0 6px ${c}14` }}
              >
                {stat.category.icon ?? <Shapes className="h-5 w-5" style={{ color: c }} />}
              </span>
              <p className="line-clamp-2 text-xs font-semibold leading-tight">{stat.category.name}</p>
              <p className="text-[11px] leading-tight text-muted-foreground">
                {stat.projects.length} projet{stat.projects.length !== 1 ? "s" : ""}
                {stat.activeCount > 0 ? ` · ${stat.activeCount} en cours` : ""}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

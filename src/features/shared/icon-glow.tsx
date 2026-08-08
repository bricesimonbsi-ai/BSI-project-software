import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Halo doux teinté de l'accent du thème actif, derrière une icône/emoji — même esprit que le
 * halo du logo sur les écrans de connexion. Utilisé avec parcimonie (icônes "phares" : encart
 * en avant, en-tête de page), pas sur des listes répétées, pour rester discret. S'adapte
 * automatiquement au clair/sombre et au thème choisi puisqu'il repose sur bg-accent. */
export function IconGlow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-flex flex-shrink-0 items-center justify-center", className)}>
      <span className="pointer-events-none absolute inset-0 -z-10 scale-150 rounded-full bg-accent/25 blur-xl dark:bg-accent/35" aria-hidden="true" />
      {children}
    </span>
  );
}

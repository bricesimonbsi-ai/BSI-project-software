import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Bandeau d'en-tête façon "hero" : bordure et dégradé teintés de l'accent du thème actif — même
 * langage visuel que l'encart "projet en avant" de la page d'accueil, repris ici pour unifier les
 * en-têtes de page (projet, voyage, catégorie). Compatible clair/sombre par construction (repose
 * sur les tokens --accent/--border, jamais une couleur fixe). */
export function PageHeroCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-lg border border-accent/30 bg-gradient-to-br from-accent/10 to-transparent p-4", className)}>
      {children}
    </div>
  );
}

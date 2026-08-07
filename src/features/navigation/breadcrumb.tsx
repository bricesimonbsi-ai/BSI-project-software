import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  to?: string;
  icon?: string | null;
}

/** Fil d'Ariane cliquable (Accueil > Catégorie > Projet) : redonne un chemin de retour rapide
 * depuis une page de projet, sans devoir repasser par le logo puis reparcourir les catégories. */
export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />}
          {item.to ? (
            <Link to={item.to} className="flex items-center gap-1 hover:text-foreground hover:underline">
              {item.icon && <span>{item.icon}</span>}
              {item.label}
            </Link>
          ) : (
            <span className="flex items-center gap-1 font-medium text-foreground">
              {item.icon && <span>{item.icon}</span>}
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

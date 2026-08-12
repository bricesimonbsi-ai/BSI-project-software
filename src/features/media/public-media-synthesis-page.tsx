import { useParams } from "react-router-dom";
import { usePublicMediaSynthesis } from "@/features/media/use-public-media-synthesis";
import { mediaPosterUrl, MEDIA_TYPE_LABELS } from "@/features/media/media-constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Film, Tv, Gamepad2 } from "lucide-react";
import type { MediaType, PublicMediaSynthesisItem } from "@/types/database";

const TYPE_ICON: Record<MediaType, typeof Film> = { film: Film, serie: Tv, jeu: Gamepad2 };

/**
 * Page publique (aucune authentification requise) : recommandations d'un projet média — les
 * contenus notés, du mieux au moins bien noté, avec le détail de la note et du commentaire de
 * chaque personne — pour partager ses avis sans donner accès au reste du portefeuille.
 */
export function PublicMediaSynthesisPage() {
  const { token } = useParams<{ token: string }>();
  const { meta, items } = usePublicMediaSynthesis(token);

  if (meta === undefined) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement...</div>;
  }

  if (meta === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-lg font-semibold">Cette synthèse n'est pas (ou plus) partagée.</p>
        <p className="text-sm text-muted-foreground">Le lien est peut-être expiré ou a été désactivé par son auteur.</p>
      </div>
    );
  }

  const labels = MEDIA_TYPE_LABELS[meta.media_type];

  return (
    <div className="min-h-screen bg-background dark:bg-[radial-gradient(circle_at_50%_0%,_hsl(250_35%_16%),_transparent_55%)]">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div className="space-y-1 text-center">
          <div className="text-4xl">{meta.icon ?? labels.icon}</div>
          <h1 className="text-3xl font-bold">{meta.title}</h1>
          <p className="text-sm text-muted-foreground">Recommandations {labels.plural.toLowerCase()}</p>
        </div>

        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Rien de noté pour l'instant.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <MediaSynthesisCard key={item.item_id} item={item} />
            ))}
          </div>
        )}

        <p className="pt-4 text-center text-xs text-muted-foreground">Publié avec Projeko</p>
      </div>
    </div>
  );
}

function MediaSynthesisCard({ item }: { item: PublicMediaSynthesisItem }) {
  const poster = mediaPosterUrl({ type: item.media_type, poster_path: item.poster_path });
  const Icon = TYPE_ICON[item.media_type];

  return (
    <Card>
      <CardContent className="flex gap-3 p-4">
        {poster ? (
          <img src={poster} alt="" className="h-28 w-20 flex-shrink-0 rounded object-cover" />
        ) : (
          <div className="flex h-28 w-20 flex-shrink-0 items-center justify-center rounded bg-muted">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold leading-tight">{item.title}</h3>
            <Badge variant="secondary" className="flex flex-shrink-0 items-center gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {item.avg_rating.toFixed(1)}/10
            </Badge>
          </div>
          {item.release_date && <p className="text-xs text-muted-foreground">{item.release_date.slice(0, 4)}</p>}

          <div className="space-y-1.5 border-t border-border pt-2">
            {item.ratings.map((r, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{r.person_name}</span>{" "}
                <span className="text-muted-foreground">— {r.rating.toFixed(1)}/10</span>
                {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

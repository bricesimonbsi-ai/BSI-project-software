import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";
import { journalPhotoUrl } from "@/features/voyages/journal/use-journal";
import { JournalStoryFeed, type StoryFeedEntry } from "@/features/voyages/journal/journal-story-feed";
import { PersonAvatarBadge } from "@/features/people/person-avatar";
import { formatDate } from "@/lib/utils";
import type { PublicJournalEntry, PublicJournalMeta, PublicJournalTraveler } from "@/types/database";

/**
 * Page publique du journal de voyage : accessible sans authentification via un lien de partage
 * (voyages.journal_share_token). N'utilise jamais la session de l'app — les fonctions RPC
 * appelées sont SECURITY DEFINER et accordées au rôle "anon", tout visiteur peut donc consulter
 * ce journal (mais rien d'autre : aucune autre donnée du portefeuille n'est exposée).
 */
export function PublicJournalPage() {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<PublicJournalMeta | null | undefined>(undefined);
  const [entries, setEntries] = useState<PublicJournalEntry[]>([]);
  const [travelers, setTravelers] = useState<PublicJournalTraveler[]>([]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const [metaRes, entriesRes, travelersRes] = await Promise.all([
        supabase.rpc("get_public_journal_meta", { p_share_token: token }).maybeSingle(),
        supabase.rpc("get_public_journal", { p_share_token: token }),
        supabase.rpc("get_public_journal_travelers", { p_share_token: token }),
      ]);
      if (cancelled) return;
      setMeta((metaRes.data as PublicJournalMeta | null) ?? null);
      setEntries((entriesRes.data as PublicJournalEntry[] | null) ?? []);
      setTravelers((travelersRes.data as PublicJournalTraveler[] | null) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const dateRange = useMemo(() => {
    if (!meta?.start_date || !meta?.end_date) return null;
    return `${formatDate(meta.start_date)} → ${formatDate(meta.end_date)}`;
  }, [meta]);

  const storyEntries: StoryFeedEntry[] = useMemo(
    () =>
      entries.map((e) => ({
        id: e.post_id,
        caption: e.caption,
        entry_date: e.entry_date,
        author_name: e.author_name,
        city: e.city,
        country_region: e.country_region,
        photo_urls: e.photo_paths.map((p) => journalPhotoUrl(p)),
      })),
    [entries]
  );

  if (meta === undefined) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement...</div>;
  }

  if (meta === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-lg font-semibold">Ce journal n'est pas (ou plus) partagé.</p>
        <p className="text-sm text-muted-foreground">Le lien est peut-être expiré ou a été désactivé par son auteur.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dark:bg-[radial-gradient(circle_at_50%_0%,_hsl(250_35%_16%),_transparent_55%)]">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div className="space-y-2 text-center">
          <div className="text-4xl">{meta.icon ?? "🌍"}</div>
          <h1 className="text-3xl font-bold">{meta.title}</h1>
          {dateRange && <p className="text-sm text-muted-foreground">{dateRange}</p>}
          {travelers.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {travelers.map((t, i) => (
                <div key={t.name + i} className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 py-1 pl-1 pr-2.5">
                  <PersonAvatarBadge
                    name={t.name}
                    avatarEmoji={t.avatar_emoji}
                    avatarConfig={t.avatar_config}
                    index={i}
                    className="h-6 w-6 text-xs"
                  />
                  <span className="text-xs font-medium">{t.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {storyEntries.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Aucun souvenir publié pour l'instant.</p>
        ) : (
          <JournalStoryFeed entries={storyEntries} startDate={meta.start_date} storageKey={token ? `journal-seen-${token}` : undefined} />
        )}

        <p className="pt-4 text-center text-xs text-muted-foreground">Publié avec Projeko</p>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { JournalCommentReaction, JournalPostComment, JournalPostReaction } from "@/types/database";

/** Réactions + commentaires d'un journal public, gérés côté visiteur anonyme via les fonctions
 * RPC SECURITY DEFINER (gate = le token de partage), jamais un accès direct aux tables — voir
 * 0039_journal_reactions_comments.sql et 0043 pour les réactions sur commentaires. */
export function usePublicJournalSocial(shareToken: string | undefined) {
  const [reactions, setReactions] = useState<JournalPostReaction[]>([]);
  const [comments, setComments] = useState<JournalPostComment[]>([]);
  const [commentReactions, setCommentReactions] = useState<JournalCommentReaction[]>([]);

  const refresh = useCallback(async () => {
    if (!shareToken) return;
    const [reactionsRes, commentsRes, commentReactionsRes] = await Promise.all([
      supabase.rpc("get_public_journal_reactions", { p_share_token: shareToken }),
      supabase.rpc("get_public_journal_comments", { p_share_token: shareToken }),
      supabase.rpc("get_public_journal_comment_reactions", { p_share_token: shareToken }),
    ]);
    setReactions((reactionsRes.data as JournalPostReaction[] | null) ?? []);
    setComments((commentsRes.data as JournalPostComment[] | null) ?? []);
    setCommentReactions((commentReactionsRes.data as JournalCommentReaction[] | null) ?? []);
  }, [shareToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function setReaction(postId: string, visitorName: string, emoji: string) {
    if (!shareToken) return;
    const { error } = await supabase.rpc("set_public_journal_reaction", {
      p_share_token: shareToken,
      p_post_id: postId,
      p_visitor_name: visitorName,
      p_emoji: emoji,
    });
    if (error) throw error;
    await refresh();
  }

  async function removeReaction(postId: string, visitorName: string) {
    if (!shareToken) return;
    const { error } = await supabase.rpc("remove_public_journal_reaction", {
      p_share_token: shareToken,
      p_post_id: postId,
      p_visitor_name: visitorName,
    });
    if (error) throw error;
    await refresh();
  }

  async function addComment(postId: string, visitorName: string, content: string) {
    if (!shareToken) return;
    const { error } = await supabase.rpc("add_public_journal_comment", {
      p_share_token: shareToken,
      p_post_id: postId,
      p_visitor_name: visitorName,
      p_content: content,
      p_parent_comment_id: null,
    });
    if (error) throw error;
    await refresh();
  }

  async function setCommentReaction(commentId: string, visitorName: string, emoji: string) {
    if (!shareToken) return;
    const { error } = await supabase.rpc("set_public_journal_comment_reaction", {
      p_share_token: shareToken,
      p_comment_id: commentId,
      p_visitor_name: visitorName,
      p_emoji: emoji,
    });
    if (error) throw error;
    await refresh();
  }

  async function removeCommentReaction(commentId: string, visitorName: string) {
    if (!shareToken) return;
    const { error } = await supabase.rpc("remove_public_journal_comment_reaction", {
      p_share_token: shareToken,
      p_comment_id: commentId,
      p_visitor_name: visitorName,
    });
    if (error) throw error;
    await refresh();
  }

  return { reactions, comments, commentReactions, setReaction, removeReaction, addComment, setCommentReaction, removeCommentReaction };
}

/** Identité du visiteur (prénom), mémorisée en localStorage par lien de partage — permet à
 * l'auteur du voyage de savoir qui a réagi/commenté sans jamais demander de compte. */
export function useVisitorIdentity(shareToken: string | undefined) {
  const key = shareToken ? `journal-visitor-${shareToken}` : undefined;
  const [name, setNameState] = useState(() => (key ? localStorage.getItem(key) ?? "" : ""));

  function setName(value: string) {
    setNameState(value);
    if (key) {
      try {
        localStorage.setItem(key, value);
      } catch {
        // stockage indisponible (navigation privée, quota...) : tant pis, on redemandera la prochaine fois
      }
    }
  }

  return { name, setName };
}

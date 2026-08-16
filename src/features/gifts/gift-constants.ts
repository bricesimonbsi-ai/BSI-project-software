import type { GiftOccasion, GiftStatus } from "@/types/database";

export const GIFT_OCCASION_LABELS: Record<GiftOccasion, string> = {
  anniversaire: "🎂 Anniversaire",
  noel: "🎄 Noël",
  autre: "✨ Autre",
};

export const GIFT_STATUS_LABELS: Record<GiftStatus, string> = {
  idee: "💡 Idée",
  achete: "🛍️ Acheté",
  offert: "🎁 Offert",
};

const STATUS_ORDER: GiftStatus[] = ["idee", "achete", "offert"];

/** Cycle idée → acheté → offert → idée, pour un statut modifiable en un clic. */
export function nextGiftStatus(status: GiftStatus): GiftStatus {
  return STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length];
}

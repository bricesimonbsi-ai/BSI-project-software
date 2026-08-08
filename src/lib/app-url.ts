/** Domaine de production fixe, à utiliser pour toute URL destinée à rester valide au-delà de la
 * session courante (lien d'invitation, lien de partage public...) — jamais window.location.origin,
 * qui peut pointer vers un déploiement de prévisualisation Vercel éphémère selon d'où l'action est
 * déclenchée (voir le bug des invitations cassées). */
export const APP_URL = "https://www.projeko.fr";

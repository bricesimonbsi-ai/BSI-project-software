# Portefeuille de projets perso

Application web progressive (PWA) React/TypeScript + Supabase pour centraliser des projets personnels dans un portefeuille par catégories, avec un module Voyages enrichi (voyage → étape → sous-étape → budget/documents).

## Stack

- React + TypeScript + Vite
- React Router, TanStack Query (état serveur), Zustand (état UI léger : thème)
- Tailwind CSS + shadcn/ui (Radix)
- Supabase (Postgres + Auth + Storage)
- vite-plugin-pwa (manifest + service worker, cache offline en lecture)

## Démarrage

```bash
npm install
cp .env.local.example .env.local
# renseigner VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY dans .env.local
npm run dev
```

## Appliquer le schéma Supabase

Les migrations SQL sont dans `supabase/migrations/`, à exécuter **dans l'ordre numérique** :

- Via la CLI Supabase (recommandé si tu as le mot de passe DB) :
  ```bash
  npx supabase login
  npx supabase link --project-ref <ton-project-ref>
  npx supabase db push
  ```
- Ou en collant le contenu de chaque fichier dans le SQL Editor du dashboard Supabase (Project → SQL Editor → New query), dans l'ordre des numéros de fichiers.

Le premier compte créé via l'écran d'inscription de l'application devient automatiquement administrateur (voir `0001_profiles_admin_bootstrap.sql`).

## Scripts

- `npm run dev` — serveur de développement
- `npm run build` — typecheck + build de production (sortie dans `dist/`)
- `npm run typecheck` — vérification TypeScript seule
- `npm run lint` — ESLint

## Déploiement

- **Frontend** : Vercel, connecté à ce dépôt GitHub. Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` dans les variables d'environnement du projet Vercel (jamais commitées).
- **Backend** : Supabase (projet déjà créé), migrations appliquées comme ci-dessus.

## Choix par défaut de cette itération (à valider)

Voir le plan d'implémentation pour le détail : bootstrap admin implicite, inscription ouverte sans accès tant qu'aucune invitation n'est accordée, invitation de collaborateur par email en attente (pas d'envoi d'email réel), taux de change saisi manuellement par dépense, offline en lecture seule cette itération, catégories de budget Voyages fixes.

Différé à une itération ultérieure : envoi réel de notifications push/email, conversion de devises via API externe, synchronisation offline en écriture, biométrie.

import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { ReactNode } from "react";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      // Permet l'affichage des dernières données connues quand hors ligne.
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "portefeuille-projets-cache",
});

export function AppQueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 3, // 3 jours de cache pour la consultation hors ligne
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

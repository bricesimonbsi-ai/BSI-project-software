import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import { invalidateAllExpenseQueries } from "@/features/voyages/use-expenses";
import { computeImportDates, type ImportCountry } from "@/features/voyages/itinerary/itinerary-csv";
import type { VoyageSousEtape } from "@/types/database";

function onMutationError(err: unknown) {
  toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
}

/**
 * Remplace intégralement l'itinéraire d'un voyage par le contenu importé (pas de fusion avec
 * l'existant — un import CSV est pensé comme "restaurer depuis ce fichier", cohérent avec le
 * cas d'usage principal : exporter, éditer dans Excel, réimporter). Supprimer les étapes
 * existantes cascade en base sur leurs villes et dépenses (déjà le cas pour useDeleteEtape).
 */
export function useImportItinerary(voyageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ countries, anchorStartDate }: { countries: ImportCountry[]; anchorStartDate: string | null }) => {
      const { data: existing, error: fetchErr } = await supabase.from("voyage_etapes").select("id").eq("voyage_id", voyageId);
      if (fetchErr) throw fetchErr;
      if (existing && existing.length > 0) {
        const { error: delErr } = await supabase.from("voyage_etapes").delete().in("id", existing.map((e) => e.id));
        if (delErr) throw delErr;
      }
      if (countries.length === 0) return;

      const etapePayload = countries.map((c, i) => ({
        voyage_id: voyageId,
        country_region: c.country_region,
        visa_needed: c.visa_needed,
        vaccines: c.vaccines,
        intl_permit_needed: c.intl_permit_needed,
        order_index: i,
      }));
      const { data: insertedEtapes, error: insErr } = await supabase.from("voyage_etapes").insert(etapePayload).select("id, order_index");
      if (insErr) throw insErr;

      const etapeIdByOrder = new Map((insertedEtapes ?? []).map((e) => [e.order_index, e.id as string]));
      const dates = computeImportDates(countries, anchorStartDate);
      let dateCursor = 0;

      const sousPayload: (Partial<VoyageSousEtape> & { etape_id: string; order_index: number; city: string })[] = [];
      countries.forEach((country, i) => {
        const etapeId = etapeIdByOrder.get(i);
        country.cities.forEach((city, j) => {
          const { start_date, end_date } = dates[dateCursor];
          dateCursor++;
          if (!etapeId) return;
          sousPayload.push({
            etape_id: etapeId,
            order_index: j,
            city: city.city,
            start_date,
            end_date,
            duration_days: city.duration_days,
            lodging: city.lodging,
            activities: city.activities,
            transport_next_mode: city.transport_next_mode,
            transport_next_duration_hours: city.transport_next_duration_hours,
            transport_next_cost: city.transport_next_cost,
            transport_next_currency: city.transport_next_currency,
            distance_km: city.distance_km,
            latitude: city.latitude,
            longitude: city.longitude,
            lodging_cost_per_night: city.lodging_cost_per_night,
            food_cost_per_day: city.food_cost_per_day,
            local_transport_cost_per_day: city.local_transport_cost_per_day,
          });
        });
      });

      if (sousPayload.length > 0) {
        const { error: subErr } = await supabase.from("voyage_sous_etapes").insert(sousPayload);
        if (subErr) throw subErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["etapes", voyageId] });
      queryClient.invalidateQueries({ queryKey: ["voyage-sous-etapes", voyageId] });
      invalidateAllExpenseQueries(queryClient);
      toast({ title: "Itinéraire importé" });
    },
    onError: onMutationError,
  });
}

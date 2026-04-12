import { useQuery } from "@tanstack/react-query";
import { fetchEvents } from "@/lib/events";

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
    staleTime: 60_000,
  });
}

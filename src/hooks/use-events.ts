import { useQuery } from "@tanstack/react-query";
import { fetchEvents, fetchEventById } from "@/lib/events";

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => fetchEvents(true),
    staleTime: 60_000,
  });
}

export function useEvent(id?: string) {
  return useQuery({
    queryKey: ["events", id],
    queryFn: () => id ? fetchEventById(id) : null,
    enabled: !!id,
    staleTime: 60_000,
  });
}

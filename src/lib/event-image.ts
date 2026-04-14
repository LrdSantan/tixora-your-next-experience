import type { Event } from "@/lib/mock-data";
import concert1 from "@/assets/event-concert-1.jpg";
import concert2 from "@/assets/event-concert-2.jpg";
import sports1 from "@/assets/event-sports-1.jpg";
import sports2 from "@/assets/event-sports-2.jpg";
import comedy from "@/assets/event-comedy.jpg";
import festival from "@/assets/event-festival.jpg";

const EVENT_IMAGES: Record<string, string> = {
  "1": concert1,
  "2": concert2,
  "3": sports1,
  "4": sports2,
  "5": comedy,
  "6": festival,
};

const CATEGORY_FALLBACK: Record<string, string> = {
  Concerts: concert1,
  Sports: sports1,
  Comedy: comedy,
  Festivals: festival,
  Theatre: concert2,
};

export function getEventImage(event: Pick<Event, "id" | "banner_url" | "cover_image_url" | "category">): string {
  if (event.cover_image_url?.trim()) return event.cover_image_url;
  if (event.banner_url?.trim()) return event.banner_url;
  const legacy = EVENT_IMAGES[event.id];
  if (legacy) return legacy;
  return CATEGORY_FALLBACK[event.category] ?? concert1;
}

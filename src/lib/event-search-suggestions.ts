import type { Event } from "@/lib/mock-data";

function norm(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Rank events for autocomplete: title match preferred, then venue/city/category.
 */
export function getEventSearchSuggestions(events: Event[], rawQuery: string, limit = 8): Event[] {
  const q = norm(rawQuery);
  if (!q) return [];

  const scored = events
    .map((event) => {
      const title = norm(event.title);
      const venue = norm(event.venue);
      const city = norm(event.city);
      const cat = norm(event.category);

      const matches =
        title.includes(q) || venue.includes(q) || city.includes(q) || cat.includes(q);
      if (!matches) return { event, score: -1 };

      let score = 0;
      if (title.startsWith(q)) score += 120;
      else if (title.includes(q)) score += 90;
      if (venue.startsWith(q) || city.startsWith(q)) score += 45;
      else if (venue.includes(q) || city.includes(q)) score += 35;
      if (cat.includes(q)) score += 25;

      return { event, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.event.title.localeCompare(b.event.title))
    .slice(0, limit)
    .map((x) => x.event);

  return scored;
}

import type { Event } from "@/lib/mock-data";

export type DateFilterPreset = "all" | "upcoming" | "this_month" | "next_90_days";

export type EventFilterOptions = {
  search: string;
  category: string | null;
  datePreset: DateFilterPreset;
};

function parseLocalDate(ymd: string): Date {
  const base = ymd.split("T")[0] ?? ymd;
  const [y, m, d] = base.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

export function matchesDateFilter(dateStr: string, preset: DateFilterPreset): boolean {
  const d = parseLocalDate(dateStr);
  if (Number.isNaN(d.getTime())) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  if (preset === "all") return true;
  if (preset === "upcoming") return d >= today;
  if (preset === "this_month") {
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  }
  if (preset === "next_90_days") {
    const end = new Date(today);
    end.setDate(end.getDate() + 90);
    return d >= today && d <= end;
  }
  return true;
}

function buildSearchHaystack(event: Event): string {
  return [event.title, event.venue, event.city, event.category].join(" ").toLowerCase();
}

/**
 * Client-side filter on already-fetched events. Case-insensitive.
 * Search matches title, venue, city, and category; all whitespace-separated terms must appear somewhere in that haystack.
 */
export function filterEvents(events: Event[], opts: EventFilterOptions): Event[] {
  const raw = opts.search.trim().toLowerCase();
  const terms = raw ? raw.split(/\s+/).filter(Boolean) : [];
  const cat = opts.category?.trim().toLowerCase() ?? null;

  return events.filter((event) => {
    if (!matchesDateFilter(event.date, opts.datePreset)) return false;
    if (cat && event.category.trim().toLowerCase() !== cat) return false;
    if (terms.length === 0) return true;
    const hay = buildSearchHaystack(event);
    return terms.every((t) => hay.includes(t));
  });
}

export function parseDatePreset(value: string | null): DateFilterPreset {
  if (value === "upcoming" || value === "this_month" || value === "next_90_days") return value;
  return "all";
}

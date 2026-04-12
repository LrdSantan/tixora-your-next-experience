import { isBefore, parseISO, startOfDay } from "date-fns";

/** True when the event calendar day is strictly before today (local). */
export function isEventDatePassed(eventDateStr: string): boolean {
  const ymd = eventDateStr?.slice(0, 10);
  if (!ymd || ymd.length < 10) return false;
  const eventDay = startOfDay(parseISO(ymd));
  const today = startOfDay(new Date());
  return isBefore(eventDay, today);
}

export function formatPurchaseDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

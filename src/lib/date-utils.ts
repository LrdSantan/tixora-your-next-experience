import { formatDate as baseFormatDate } from "./mock-data";

/**
 * Formats an event's date display.
 * For single-day events: "Jun 1, 2025"
 * For multi-day events: "Jun 1 – Jun 3, 2025"
 */
export function formatEventDateDisplay(date: string, isMultiDay: boolean, eventDays: any[] = []) {
  if (!isMultiDay || !eventDays || eventDays.length <= 1) {
    return baseFormatDate(date);
  }

  // Ensure eventDays are sorted
  const sortedDays = [...eventDays].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const startDate = new Date(sortedDays[0]);
  const endDate = new Date(sortedDays[sortedDays.length - 1]);

  const startMonth = startDate.toLocaleString('en-US', { month: 'short' });
  const startDay = startDate.getDate();
  const endMonth = endDate.toLocaleString('en-US', { month: 'short' });
  const endDay = endDate.getDate();
  const year = endDate.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} – ${endDay}, ${year}`;
  } else {
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  }
}

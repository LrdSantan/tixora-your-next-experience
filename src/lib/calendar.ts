export interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  startDate: string; // ISO format e.g. "2026-06-21"
  startTime: string; // e.g. "20:00"
  durationHours?: number; // default 2
}

export function generateCalendarLinks(event: CalendarEvent) {
  const start = new Date(`${event.startDate}T${event.startTime || '00:00'}:00`);
  const end = new Date(start.getTime() + (event.durationHours || 2) * 60 * 60 * 1000);

  const formatGCal = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');
  const formatOutlook = (d: Date) => d.toISOString();

  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatGCal(start)}/${formatGCal(end)}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location)}`;
  
  const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${formatOutlook(start)}&enddt=${formatOutlook(end)}&body=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location)}`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${formatGCal(start)}`,
    `DTEND:${formatGCal(end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\n');

  return { googleUrl, outlookUrl, icsContent };
}

export function downloadIcs(title: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${title.replace(/[^\w-]/g, '-').toLowerCase()}-ticket.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

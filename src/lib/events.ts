import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { EVENTS, type Event } from "@/lib/mock-data";

type EventRow = {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  category: string;
  banner_url: string;
  cover_image_url: string;
  status: string;
  organizer_id: string | null;
  organizer_email: string | null;
  created_at: string;
  ticket_tiers: TicketTierRow[] | null;
};

type TicketTierRow = {
  id: string;
  event_id: string;
  name: string;
  description: string;
  price: number;
  total_quantity: number;
  remaining_quantity: number;
};

function mapRow(row: EventRow): Event {
  const tiers = (row.ticket_tiers ?? []).map((t) => ({
    id: t.id,
    event_id: t.event_id,
    name: t.name,
    description: t.description,
    price: t.price,
    total_quantity: t.total_quantity,
    remaining_quantity: t.remaining_quantity,
  }));
  const dateStr = typeof row.date === "string" && row.date.includes("T") ? row.date.split("T")[0] : row.date;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: dateStr,
    time: row.time,
    venue: row.venue,
    city: row.city,
    category: row.category,
    banner_url: row.banner_url ?? "",
    cover_image_url: row.cover_image_url,
    status: row.status,
    organizer_id: row.organizer_id ?? undefined,
    organizer_email: row.organizer_email ?? undefined,
    created_at: row.created_at,
    ticket_tiers: tiers,
  };
}

export async function fetchEvents(filterActive = true): Promise<Event[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return EVENTS;

  let query = supabase
    .from("events")
    .select(
      `
      id,
      title,
      description,
      date,
      time,
      venue,
      city,
      category,
      banner_url,
      cover_image_url,
      status,
      organizer_id,
      organizer_email,
      created_at,
      ticket_tiers (
        id,
        event_id,
        name,
        description,
        price,
        total_quantity,
        remaining_quantity
      )
    `,
    );

  if (filterActive) {
    const today = new Date().toISOString().split("T")[0];
    query = query.eq("status", "active").gte("date", today);
  }

  const { data, error } = await query.order("date", { ascending: true });

  if (error) {
    console.warn("[events] Supabase fetch failed, using local mock data:", error.message);
    return EVENTS;
  }

  const rows = (data ?? []) as EventRow[];
  if (rows.length === 0 && isSupabaseConfigured) {
    return EVENTS;
  }

  return rows.map(mapRow);
}

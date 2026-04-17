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
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
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
    bank_name: row.bank_name ?? undefined,
    account_number: row.account_number ?? undefined,
    account_name: row.account_name ?? undefined,
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
      date,
      time,
      venue,
      city,
      category,
      cover_image_url,
      status,
      bank_name,
      account_number,
      account_name,
      ticket_tiers (
        id,
        event_id,
        name,
        description,
        price,
        total_quantity,
        remaining_quantity
      )
    `
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

export async function fetchEventById(id: string): Promise<Event | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return EVENTS.find((e) => e.id === id) || null;

  const { data, error } = await supabase
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
      bank_name,
      account_number,
      account_name,
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
    `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    console.warn("[events] Supabase fetchEventById failed:", error?.message);
    return EVENTS.find((e) => e.id === id) || null;
  }

  const eventRow = data as EventRow;
  if (eventRow.ticket_tiers && eventRow.ticket_tiers.length > 0) {
    for (const tier of eventRow.ticket_tiers) {
      const { count } = await supabase
        .from("ticket_resells")
        .select("id, tickets!inner(tier_id, event_id)", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("tickets.tier_id", tier.id)
        .eq("tickets.event_id", id);
      
      if (count !== null) {
        tier.remaining_quantity += count;
      }
    }
  }

  return mapRow(eventRow);
}

export async function fetchEventSearch(searchQuery: string): Promise<Event[]> {
  const supabase = getSupabaseClient();
  if (!supabase || !searchQuery.trim()) return [];

  const today = new Date().toISOString().split("T")[0];
  
  const { data, error } = await supabase
    .from("events")
    .select(
      `
      id,
      title,
      date,
      time,
      venue,
      city,
      category,
      cover_image_url,
      status,
      ticket_tiers (
        price
      )
    `
    )
    .eq("status", "active")
    .gte("date", today)
    .or(`title.ilike.%${searchQuery}%,venue.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`)
    .order("date", { ascending: true })
    .limit(10);

  if (error) {
    console.warn("[events] Supabase fetchEventSearch failed:", error.message);
    return [];
  }

  return ((data ?? []) as EventRow[]).map(mapRow);
}

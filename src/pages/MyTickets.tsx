import { Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { TicketDownloadBlock } from "@/components/TicketDownloadBlock";
import type { TicketVisualModel } from "@/components/TicketVisualCard";
import { isEventDatePassed } from "@/lib/ticket-utils";

type TicketRow = {
  id: string;
  reference: string;
  amount_paid: number;
  quantity: number;
  created_at: string;
  events: {
    title: string;
    date: string;
    time: string;
    venue: string;
    city: string;
  } | null;
  ticket_tiers: { name: string } | null;
};

function rowToModel(row: TicketRow, buyerName: string, buyerEmail: string): TicketVisualModel {
  const ev = row.events;
  return {
    reference: row.reference,
    eventTitle: ev?.title ?? "Event",
    eventDate: ev?.date ? String(ev.date) : "",
    eventTime: ev?.time ?? "",
    venue: ev?.venue ?? "",
    city: ev?.city ?? "",
    tierName: row.ticket_tiers?.name ?? "Ticket",
    quantity: row.quantity,
    amountPaidKobo: row.amount_paid,
    buyerName,
    buyerEmail,
    purchasedAt: row.created_at,
  };
}

const MyTicketsPage = () => {
  const { user, loading } = useAuth();
  const supabase = getSupabaseClient();

  const meta = user?.user_metadata as { full_name?: string } | undefined;
  const buyerName = meta?.full_name?.trim() || user?.email?.split("@")[0] || "Guest";
  const buyerEmail = user?.email ?? "";

  const query = useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: Boolean(user && supabase && isSupabaseConfigured),
    queryFn: async () => {
      if (!supabase || !user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("tickets")
        .select(
          `
          id,
          reference,
          amount_paid,
          quantity,
          created_at,
          events ( title, date, time, venue, city ),
          ticket_tiers ( name )
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as TicketRow[];
    },
  });

  if (loading) {
    return (
      <div className="container mx-auto max-w-2xl space-y-4 px-4 py-12">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Ticket className="mx-auto mb-4 h-16 w-16 rotate-[-30deg] text-primary" />
        <h1 className="mb-2 text-2xl font-bold text-foreground">Sign in to view your tickets</h1>
        <p className="mb-6 text-muted-foreground">You need to be logged in to see your booked tickets.</p>
        <Link to="/login">
          <Button className="bg-primary text-primary-foreground">Sign In</Button>
        </Link>
      </div>
    );
  }

  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        <p>Supabase is not configured. Add credentials to load your tickets.</p>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="container mx-auto max-w-3xl space-y-4 px-4 py-12">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (query.isError) {
    const err = query.error as Error;
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-destructive mb-2">Could not load tickets</p>
        <p className="text-sm text-muted-foreground">{err.message}</p>
      </div>
    );
  }

  const rows = query.data ?? [];
  const active = rows.filter((r) => !isEventDatePassed(r.events?.date ? String(r.events.date) : ""));
  const expired = rows.filter((r) => isEventDatePassed(r.events?.date ? String(r.events.date) : ""));

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-foreground">My Tickets</h1>
      <p className="mb-8 text-sm text-muted-foreground">Signed in as {user.email}</p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">No tickets yet. Browse events to get started!</p>
      ) : (
        <div className="space-y-12">
          {active.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-foreground">Active</h2>
              <div className="space-y-8">
                {active.map((row) => (
                  <TicketDownloadBlock key={row.id} model={rowToModel(row, buyerName, buyerEmail)} />
                ))}
              </div>
            </section>
          )}

          {expired.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-muted-foreground">Past events</h2>
              <div className="space-y-8 opacity-95">
                {expired.map((row) => (
                  <TicketDownloadBlock key={row.id} model={rowToModel(row, buyerName, buyerEmail)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default MyTicketsPage;

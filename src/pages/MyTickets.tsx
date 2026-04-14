import { useState } from "react";
import { Ticket, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { TicketDownloadBlock } from "@/components/TicketDownloadBlock";
import type { TicketVisualModel } from "@/components/TicketVisualCard";
import { TicketVisualCardSkeleton } from "@/components/TicketVisualCardSkeleton";
import { isEventDatePassed } from "@/lib/ticket-utils";

type TicketRow = {
  id: string;
  reference: string;
  ticket_code: string | null;
  amount_paid: number;
  quantity: number;
  is_used: boolean;
  used_at: string | null;
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
    ticketCode: row.ticket_code ?? undefined,
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
    isUsed: row.is_used,
    usedAt: row.used_at,
  };
}

const MyTicketsPage = () => {
  const { user, loading } = useAuth();
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [clearing, setClearing] = useState(false);

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
          ticket_code,
          amount_paid,
          quantity,
          is_used,
          used_at,
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
      <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8 animate-pulse">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-4 w-64 mb-8" />
        <div className="space-y-8">
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
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
      <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-4 w-64 mb-8" />
        <div className="space-y-8">
          <TicketVisualCardSkeleton />
          <TicketVisualCardSkeleton />
          <TicketVisualCardSkeleton />
        </div>
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
  const hasUsedOrExpired = rows.some((r) => r.is_used || isEventDatePassed(r.events?.date ? String(r.events.date) : ""));
  
  const filteredRows = rows.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const evTitle = r.events?.title?.toLowerCase() || "";
    const code = r.ticket_code?.toLowerCase() || "";
    const venue = r.events?.venue?.toLowerCase() || "";
    return evTitle.includes(q) || code.includes(q) || venue.includes(q);
  });

  const active = filteredRows.filter((r) => !isEventDatePassed(r.events?.date ? String(r.events.date) : ""));
  const expired = filteredRows.filter((r) => isEventDatePassed(r.events?.date ? String(r.events.date) : ""));

  const handleClear = async () => {
    if (!supabase || !user) return;
    if (!window.confirm("This will remove all used and expired tickets from your list. Are you sure?")) return;
    
    setClearing(true);
    try {
      const ticketsToDelete = rows.filter((r) => r.is_used || isEventDatePassed(r.events?.date ? String(r.events.date) : ""));
      if (ticketsToDelete.length === 0) {
        toast.info("No used or expired tickets to clear.");
        setClearing(false);
        return;
      }
      
      const ids = ticketsToDelete.map(t => t.id);
      
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('user_id', user.id)
        .in('id', ids);
        
      if (error) throw error;
      
      toast.success("Your used and expired tickets have been cleared");
      queryClient.invalidateQueries({ queryKey: ["my-tickets", user.id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to clear tickets");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">My Tickets</h1>
        {hasUsedOrExpired && (
          <Button variant="outline" size="sm" onClick={handleClear} disabled={clearing} className="w-full sm:w-auto text-muted-foreground hover:text-destructive border-dashed">
            {clearing ? "Clearing..." : "Clear Used & Expired"}
          </Button>
        )}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">Signed in as {user.email}</p>
      
      <div className="mb-8 rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
        <p>Used tickets are automatically removed after 24 hours.</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">No tickets yet. Browse events to get started!</p>
      ) : (
        <div className="space-y-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by event, code, or venue..." 
              className="pl-9 pr-10" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:bg-transparent"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {filteredRows.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No tickets found matching "{searchQuery}"</p>
              <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2 text-primary">Clear search</Button>
            </div>
          ) : (
            <div className="space-y-12">
          {active.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-foreground">Active</h2>
              <div className="space-y-8">
                {active.map((row) => (
                  <div key={row.id} className="relative">
                    {/* Used/Active badge overlay */}
                    <div className="absolute top-3 right-3 z-10">
                      {row.is_used ? (
                        <Badge className="bg-neutral-500 text-white border-0">
                          Used {row.used_at ? `· ${new Date(row.used_at).toLocaleDateString()}` : ""}
                        </Badge>
                      ) : (
                        <Badge className="bg-green-600 text-white border-0">Active</Badge>
                      )}
                    </div>
                    <TicketDownloadBlock model={rowToModel(row, buyerName, buyerEmail)} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {expired.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-muted-foreground">Past events</h2>
              <div className="space-y-8 opacity-95">
                {expired.map((row) => (
                  <div key={row.id} className="relative">
                    <div className="absolute top-3 right-3 z-10">
                      {row.is_used ? (
                        <Badge className="bg-neutral-500 text-white border-0">Used</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Unused</Badge>
                      )}
                    </div>
                    <TicketDownloadBlock model={rowToModel(row, buyerName, buyerEmail)} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MyTicketsPage;

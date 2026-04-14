import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle, XCircle, AlertTriangle, ShieldCheck, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ADMIN_EMAIL = "yusufquadir50@gmail.com";

type TicketData = {
  id: string;
  ticket_code: string;
  reference: string;
  amount_paid: number;
  is_used: boolean;
  used_at: string | null;
  created_at: string;
  event_id: string | null;
  events: {
    title: string;
    date: string;
    time: string;
    venue: string;
    city: string;
    organizer_id: string | null;
  } | null;
  ticket_tiers: { name: string } | null;
};

type PageState = "loading" | "not_found" | "valid" | "used";

export default function VerifyTicketPage() {
  const { ticketCode } = useParams<{ ticketCode: string }>();
  const supabase = getSupabaseClient();
  const { user, loading: authLoading } = useAuth();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [marking, setMarking] = useState(false);
  const [isOrganizerOrTeam, setIsOrganizerOrTeam] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const isAdmin = !authLoading && user?.email === ADMIN_EMAIL;
  const canMark = isAdmin || isOrganizerOrTeam;

  useEffect(() => {
    async function fetchTicket() {
      if (!supabase || !ticketCode) {
        setPageState("not_found");
        return;
      }

      const { data, error } = await supabase
        .from("tickets")
        .select(`
          id,
          ticket_code,
          reference,
          amount_paid,
          is_used,
          used_at,
          created_at,
          event_id,
          events ( title, date, time, venue, city, organizer_id ),
          ticket_tiers ( name )
        `)
        .eq("ticket_code", ticketCode)
        .single();

      if (error || !data) {
        setPageState("not_found");
        return;
      }

      setTicket(data as TicketData);
      setPageState(data.is_used ? "used" : "valid");
    }

    fetchTicket();
  }, [ticketCode, supabase]);

  // Check if the current user is organizer or accepted team member
  useEffect(() => {
    async function checkOrganizerAccess() {
      if (authLoading) return;
      setAuthChecking(true);
      try {
        if (!supabase || !user || !ticket) {
          setIsOrganizerOrTeam(false);
          return;
        }
        const organizerId = ticket.events?.organizer_id;
        if (!organizerId) {
          setIsOrganizerOrTeam(false);
          return;
        }
        // Check if user is the organizer
        if (user.id === organizerId) {
          setIsOrganizerOrTeam(true);
          return;
        }
        // Check if user is an accepted team member of the organizer
        const { data: membership } = await supabase
          .from("organizer_team_members")
          .select("id")
          .eq("organizer_id", organizerId)
          .eq("member_id", user.id)
          .eq("status", "accepted")
          .maybeSingle();
        setIsOrganizerOrTeam(Boolean(membership));
      } finally {
        setAuthChecking(false);
      }
    }
    checkOrganizerAccess();
  }, [ticket, user, authLoading, supabase]);

  const handleMarkUsed = async () => {
    if (!supabase || !ticket) return;
    setMarking(true);
    try {
      const { data, error } = await supabase.rpc("mark_ticket_used", {
        p_ticket_code: ticket.ticket_code,
      });

      if (error) throw error;

      setTicket((prev) => prev ? { ...prev, is_used: true, used_at: new Date().toISOString() } : prev);
      setPageState("used");
      toast.success("Ticket marked as used successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to mark ticket as used");
    } finally {
      setMarking(false);
    }
  };

  // ── Loading ──
  if (pageState === "loading" || authLoading || authChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // ── Not Found ──
  if (pageState === "not_found") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-6 sm:p-8 text-center overflow-hidden">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900 mb-2">Invalid Ticket</h1>
          <p className="text-neutral-500 mb-6">
            The ticket code <span className="font-mono font-bold text-neutral-700">{ticketCode}</span> was not found in our system. This ticket may be invalid or the code may be incorrect.
          </p>
          <div className="rounded-xl bg-red-50 border border-red-200 p-4">
            <p className="text-sm font-semibold text-red-700">⛔ Do not grant entry with this ticket</p>
          </div>
          <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">← Back to Tixora</Link>
        </div>
      </div>
    );
  }

  const ev = ticket?.events;
  const tierName = ticket?.ticket_tiers?.name ?? "Ticket";
  const amountPaid = ticket ? `₦${(ticket.amount_paid / 100).toLocaleString()}` : "";

  // ── Used ──
  if (pageState === "used") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8 sm:py-12 w-full overflow-x-hidden">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-6 sm:p-8 overflow-hidden">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-neutral-900">Ticket Already Used</h1>
            {ticket?.used_at && (
              <p className="mt-2 text-sm text-neutral-500">
                Used on {new Date(ticket.used_at).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short" })}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-orange-50 border border-orange-200 p-4 mb-6">
            <p className="text-sm font-semibold text-orange-700">⚠️ This ticket has already been scanned. Do not grant re-entry.</p>
          </div>

          <TicketDetailCard ticket={ticket!} ev={ev} tierName={tierName} amountPaid={amountPaid} />

          <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">← Back to Tixora</Link>
        </div>
      </div>
    );
  }

  // ── Valid ──
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8 sm:py-12 w-full overflow-x-hidden">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-6 sm:p-8 overflow-hidden">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900">Valid Ticket</h1>
          <p className="mt-1 text-sm text-neutral-500">This ticket is authentic and has not been used.</p>
        </div>

        <div className="rounded-xl bg-green-50 border border-green-200 p-4 mb-6">
          <p className="text-sm font-semibold text-green-700">✅ Safe to grant entry</p>
        </div>

        <TicketDetailCard ticket={ticket!} ev={ev} tierName={tierName} amountPaid={amountPaid} />

        {/* Organizer / Team: Mark as Used */}
        {canMark ? (
          <Button
            onClick={handleMarkUsed}
            disabled={marking}
            className="w-full mt-6 h-12 text-base font-bold text-white rounded-xl bg-[#1A7A4A] hover:bg-[#155a37] flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" />
            {marking ? "Marking as used…" : "Mark as Used"}
          </Button>
        ) : (
          <div className="mt-6 rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-center">
            {user ? (
              <p className="text-sm text-neutral-500">You are not authorized to verify this ticket.</p>
            ) : (
              <>
                <p className="text-sm text-neutral-500 mb-3">Organizer? Log in to mark this ticket as used.</p>
                <Link to={`/login?redirect=/verify/${ticketCode}`}>
                  <Button variant="outline" size="sm" className="border-primary text-primary">
                    Log in
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}

        <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">← Back to Tixora</Link>
      </div>
    </div>
  );
}

// ── Shared detail card ──
function TicketDetailCard({
  ticket,
  ev,
  tierName,
  amountPaid,
}: {
  ticket: TicketData;
  ev: TicketData["events"];
  tierName: string;
  amountPaid: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 space-y-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <Ticket className="w-5 h-5 text-[#1A7A4A] rotate-[-20deg] shrink-0" />
        <span className="font-extrabold text-base text-neutral-900">{ev?.title ?? "Event"}</span>
      </div>
      <DetailRow label="Ticket Code" value={<span className="font-mono font-bold text-[#1A7A4A]">{ticket.ticket_code}</span>} />
      <DetailRow label="Tier" value={tierName} />
      <DetailRow label="Amount Paid" value={amountPaid} />
      {ev && (
        <>
          <DetailRow label="Date" value={new Date(ev.date).toLocaleDateString("en-NG", { dateStyle: "long" })} />
          <DetailRow label="Time" value={ev.time} />
          <DetailRow label="Venue" value={`${ev.venue}, ${ev.city}`} />
        </>
      )}
      <DetailRow label="Purchased" value={new Date(ticket.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })} />
      <DetailRow label="Reference" value={<span className="font-mono text-xs">{ticket.reference}</span>} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3 w-full">
      <span className="text-neutral-500 shrink-0">{label}</span>
      <span className="font-semibold text-neutral-900 text-right break-all sm:break-words min-w-0">{value}</span>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Ticket, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { getSupabaseClient } from "@/lib/supabase";
import { formatPrice, formatDate } from "@/lib/mock-data";
import { openPaystackInline, generatePaymentReference, nairaToKobo } from "@/lib/paystack";

const ClaimTicket = () => {
  const { transferToken } = useParams();
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const supabase = getSupabaseClient();
  const [claiming, setClaiming] = useState(false);

  const { data: ticket, isLoading, error } = useQuery({
    queryKey: ["claim-ticket", transferToken],
    enabled: Boolean(transferToken && supabase),
    queryFn: async () => {
      if (!supabase || !transferToken) return null;
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          id,
          user_id,
          transfer_status,
          transfer_token_expires_at,
          amount_paid,
          events ( title, date, time, venue, city ),
          ticket_tiers ( name )
        `)
        .eq("transfer_token", transferToken)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const handleClaim = async () => {
    if (!user) {
      toast.error("You must be signed in to claim this ticket.");
      navigate("/login", { state: { from: `/claim-ticket/${transferToken}` } });
      return;
    }

    if (!supabase || !transferToken) return;

    const pk = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!pk) {
      toast.error("Payment system not configured.");
      return;
    }

    const reference = generatePaymentReference();
    const amountKobo = nairaToKobo(200);

    setClaiming(true);

    openPaystackInline({
      publicKey: pk,
      email: user.email || "",
      amountKobo,
      reference,
      onSuccess: async (paidRef) => {
        try {
          if (!session?.access_token) {
            toast.error("Session expired. Please sign in again.");
            return;
          }
          const { data, error } = await supabase.functions.invoke("complete-transfer", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: { 
              transfer_token: transferToken,
              payment_reference: paidRef,
            },
          });

          if (error) throw error;

          if (data?.ok) {
            toast.success("Ticket successfully claimed! Check your email or My Tickets.");
            navigate("/my-tickets");
          } else {
            throw new Error(data?.error || "Failed to claim ticket");
          }
        } catch (err: any) {
          console.error("Claim error:", err);
          toast.error(err.message || "Could not claim ticket. It may have expired or already been claimed.");
        } finally {
          setClaiming(false);
        }
      },
      onCancel: () => {
        toast.error("Payment required to generate transfer link.", { description: "You must pay the ₦200 fee to claim." });
        setClaiming(false);
      },
    });
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verifying transfer token...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <XCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Invalid or Expired Link</h1>
        <p className="mt-2 text-muted-foreground max-w-sm">
          This transfer link is no longer valid. It may have expired or already been claimed by someone else.
        </p>
        <Button onClick={() => navigate("/")} className="mt-6">Back to Home</Button>
      </div>
    );
  }

  const isExpired = new Date(ticket.transfer_token_expires_at) < new Date();
  const isOwner = user?.id === ticket.user_id;

  if (isExpired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <XCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Transfer Link Expired</h1>
        <p className="mt-2 text-muted-foreground max-w-sm">
          Transfer links are valid for 24 hours. This one has expired.
        </p>
        <Button onClick={() => navigate("/")} className="mt-6">Back to Home</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-lg px-4 py-20">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="mb-6 flex justify-center text-primary">
          <CheckCircle2 className="h-16 w-16" />
        </div>
        
        <h1 className="text-center text-2xl font-bold">Ticket Transfer</h1>
        <p className="mt-2 text-center text-muted-foreground">
          Someone has sent you a ticket for an event!
        </p>

        <div className="mt-8 space-y-4 rounded-xl bg-muted/50 p-6 border border-border">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Event</p>
            <p className="text-lg font-bold">{ticket.events?.title}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</p>
              <p className="font-semibold">{formatDate(ticket.events?.date)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Time</p>
              <p className="font-semibold">{ticket.events?.time}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Venue</p>
            <p className="font-semibold">{ticket.events?.venue}, {ticket.events?.city}</p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ticket Type</p>
            <Badge variant="secondary" className="mt-1 font-bold">
              {ticket.ticket_tiers?.name}
            </Badge>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {!user && (
            <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800 border border-orange-100 mb-4">
              <p>Please sign in to your Tixora account to claim this ticket.</p>
            </div>
          )}

          {isOwner ? (
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 border border-blue-100 text-center">
              <p>You already own this ticket.</p>
              <Button variant="link" onClick={() => navigate("/my-tickets")} className="mt-1 h-auto p-0">Go to My Tickets</Button>
            </div>
          ) : (
            <Button 
              className="w-full h-12 text-lg font-bold" 
              onClick={handleClaim}
              disabled={claiming}
            >
              {claiming ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Claiming...
                </>
              ) : (
                "Claim Ticket Now"
              )}
            </Button>
          )}

          <p className="text-center text-sm font-medium text-amber-700 bg-amber-50 rounded-lg p-3 border border-amber-100">
            To complete the transfer and claim this ticket, a flat processing fee of ₦200 applies.
          </p>

          <p className="text-center text-xs text-muted-foreground mt-2">
            Once claimed, the original ticket will be invalidated and a new one will be issued to your account.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClaimTicket;

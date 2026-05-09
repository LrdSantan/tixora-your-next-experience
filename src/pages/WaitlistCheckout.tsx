import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2, Clock, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase";
import { useCartStore } from "@/store/cart-store";

type PageState =
  | { status: "loading" }
  | { status: "valid"; event_id: string; tier_id: string; guest_name: string; guest_email: string }
  | { status: "expired" }
  | { status: "invalid" };

export default function WaitlistCheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  const [state, setState] = useState<PageState>({ status: "loading" });

  const token = params.get("token");
  const tierId = params.get("tier");

  useEffect(() => {
    if (!token || !tierId) {
      setState({ status: "invalid" });
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setState({ status: "invalid" });
      return;
    }

    supabase.functions
      .invoke("process-waitlist-checkout", { body: { token, tier_id: tierId } })
      .then(({ data, error }) => {
        if (error) {
          setState({ status: "invalid" });
          return;
        }
        if (data?.error) {
          if (data.error.includes("expired")) {
            setState({ status: "expired" });
          } else {
            setState({ status: "invalid" });
          }
          return;
        }
        if (data?.success) {
          setState({
            status: "valid",
            event_id: data.event_id,
            tier_id: data.tier_id,
            guest_name: data.guest_name,
            guest_email: data.guest_email,
          });
        } else {
          setState({ status: "invalid" });
        }
      })
      .catch(() => setState({ status: "invalid" }));
  }, [token, tierId]);

  const handleClaimSpot = async () => {
    if (state.status !== "valid") return;

    // Fetch event + tier info to add to cart
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const { data: tierData } = await supabase
      .from("ticket_tiers")
      .select("id, name, price, remaining_quantity, event_id, events(id, title, date)")
      .eq("id", state.tier_id)
      .single();

    if (!tierData) return;

    const event = (tierData as any).events;
    addItem({
      eventId: state.event_id,
      eventTitle: event?.title ?? "Event",
      eventDate: event?.date ?? "",
      tierId: tierData.id,
      tierName: tierData.name,
      unitPrice: tierData.price,
      maxQuantity: Math.max(1, tierData.remaining_quantity),
      initialQuantity: 1,
    });

    navigate("/checkout");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <Helmet>
        <title>Claim Your Waitlist Spot | Tixora</title>
      </Helmet>

      <div className="w-full max-w-md">
        {state.status === "loading" && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-amber-100 text-amber-600">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            </div>
            <p className="text-muted-foreground font-medium">Verifying your waitlist spot…</p>
          </div>
        )}

        {state.status === "valid" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
            <div className="bg-gradient-to-r from-amber-500 to-amber-400 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 shrink-0" />
                <div>
                  <h1 className="font-bold text-lg leading-tight">Your spot is ready!</h1>
                  <p className="text-amber-100 text-sm mt-0.5">Click below to complete your purchase</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800 font-medium">
                  This offer is time-limited. Complete checkout before your 24-hour window closes.
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{state.guest_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{state.guest_email}</span>
                </div>
              </div>

              <Button
                onClick={handleClaimSpot}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 text-base shadow-md"
              >
                Claim My Spot →
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By claiming, you'll proceed to secure checkout. The spot is not confirmed until payment is complete.
              </p>
            </div>
          </div>
        )}

        {state.status === "expired" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg text-center">
            <div className="bg-gradient-to-r from-neutral-700 to-neutral-600 px-6 py-5 text-white">
              <div className="flex items-center gap-3 justify-center">
                <Clock className="w-7 h-7" />
                <h1 className="font-bold text-lg">Offer Expired</h1>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Sorry, your 24-hour window has passed. You've been removed from the waitlist and the next person has been notified.
              </p>
              <Button variant="outline" asChild className="gap-2">
                <Link to="/">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Events
                </Link>
              </Button>
            </div>
          </div>
        )}

        {state.status === "invalid" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg text-center">
            <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-5 text-white">
              <div className="flex items-center gap-3 justify-center">
                <XCircle className="w-7 h-7" />
                <h1 className="font-bold text-lg">Invalid Link</h1>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                This link is invalid or has already been used. If you believe this is an error, please contact support.
              </p>
              <Button variant="outline" asChild className="gap-2">
                <Link to="/">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Events
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

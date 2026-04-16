import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldCheck, Ticket } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { getSupabaseClient } from "@/lib/supabase";
import { generatePaymentReference, nairaToKobo, openPaystackInline } from "@/lib/paystack";
import { formatPrice, formatDate } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ResellCheckout = () => {
  const { resellId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const supabase = getSupabaseClient();

  const [resell, setResell] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [attendee, setAttendee] = useState({ name: "", email: "", phone: "" });

  useEffect(() => {
    if (user) {
      setAttendee(a => ({
        ...a,
        email: user.email || a.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || a.name
      }));
    }
  }, [user]);

  useEffect(() => {
    const fetchResell = async () => {
      if (!supabase || !resellId) return;
      try {
        const { data, error } = await supabase
          .from("ticket_resells")
          .select(`
            id,
            ticket_id,
            refund_amount,
            tickets (
              ticket_code,
              events ( id, title, date, time, venue, city ),
              ticket_tiers ( name )
            )
          `)
          .eq("id", resellId)
          .eq("status", "pending")
          .single();

        if (error || !data) {
          toast.error("Resale listing no longer available.");
          navigate("/marketplace");
          return;
        }
        setResell(data);
      } catch (err) {
        toast.error("Error loading resale details.");
      } finally {
        setLoading(false);
      }
    };

    fetchResell();
  }, [resellId, supabase, navigate]);

  const handlePay = () => {
    const pk = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!pk) {
      toast.error("Payment system not configured.");
      return;
    }
    if (!user) {
      toast.error("Please sign in to buy this ticket.");
      navigate("/login", { state: { from: `/resell/checkout/${resellId}` } });
      return;
    }

    if (!attendee.name || !attendee.email || !attendee.phone) {
      toast.error("Please fill in all contact details.");
      return;
    }

    const reference = generatePaymentReference();
    const amountKobo = nairaToKobo(resell.refund_amount);

    setPaying(true);
    openPaystackInline({
      publicKey: pk,
      email: attendee.email,
      amountKobo,
      reference,
      onSuccess: (paidRef) => {
        void (async () => {
          try {
            const { data, error } = await supabase!.functions.invoke("complete-resell", {
              body: {
                ticket_resell_id: resellId,
                new_buyer_id: user.id,
                paystack_reference: paidRef
              }
            });

            if (error || !data?.ok) {
              throw new Error(data?.error || "Failed to complete transfer.");
            }

            toast.success("Ticket purchased successfully! Check your email.");
            navigate("/my-tickets");
          } catch (err: any) {
            toast.error(err.message || "Something went wrong.");
            setPaying(false);
          }
        })();
      },
      onCancel: () => setPaying(false),
    });
  };

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!resell) return null;

  const ev = resell.tickets.events;

  return (
    <div className="min-h-screen bg-muted/30 pb-20 pt-8">
      <div className="container mx-auto max-w-4xl px-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)} 
          className="mb-6 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Marketplace
        </Button>

        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
              <h1 className="text-2xl font-bold">Secure Ticket Resale</h1>
              <p className="text-muted-foreground">This ticket is being sold by another fan via Tixora.</p>
              
              <div className="mt-8 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input 
                    placeholder="John Doe" 
                    value={attendee.name}
                    onChange={e => setAttendee({...attendee, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email Address</label>
                  <Input 
                    type="email" 
                    placeholder="john@example.com" 
                    value={attendee.email}
                    onChange={e => setAttendee({...attendee, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Phone Number</label>
                  <Input 
                    type="tel" 
                    placeholder="08012345678" 
                    value={attendee.phone}
                    onChange={e => setAttendee({...attendee, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="mt-10 rounded-xl bg-primary/5 p-4 border border-primary/10">
                <div className="flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold text-primary">Tixora Buyer Protection</p>
                    <p className="text-primary/80 mt-1">
                      We guarantee this ticket is valid. The original ticket will be cancelled and a 100% fresh one issued to you.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-bold">Order Summary</h2>
              
              <div className="mt-6 border-b border-border pb-6">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Event Detail</p>
                <h3 className="font-bold leading-tight">{ev.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatDate(ev.date)} · {ev.time}
                </p>
                <p className="text-sm text-muted-foreground">{ev.venue}, {ev.city}</p>
                <Badge variant="secondary" className="mt-3">{resell.tickets.ticket_tiers.name}</Badge>
              </div>

              <div className="space-y-3 py-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Resale Price</span>
                  <span className="font-medium">{formatPrice(resell.refund_amount / 100)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Processing Fee</span>
                  <span className="font-medium">{formatPrice(0)}</span>
                </div>
                <div className="flex justify-between border-t pt-3 text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">{formatPrice(resell.refund_amount / 100)}</span>
                </div>
              </div>

              <Button 
                className="w-full h-12 text-lg font-bold"
                onClick={handlePay}
                disabled={paying}
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Pay ${formatPrice(resell.refund_amount / 100)}`
                )}
              </Button>
              <p className="mt-3 text-center text-[10px] text-muted-foreground">
                By clicking pay, you agree to Tixora's Resale Policy.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default ResellCheckout;

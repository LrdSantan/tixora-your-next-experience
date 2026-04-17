import { Fragment, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/cart-store";
import { formatPrice } from "@/lib/mock-data";
import { useEvents } from "@/hooks/use-events";
import type { TicketTier } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { generatePaymentReference, nairaToKobo, openPaystackInline } from "@/lib/paystack";
import type { ConfirmationTicket } from "@/lib/confirmation-state";

type PaystackFnResponse = {
  ok?: boolean;
  data?: { tickets: RpcTicketRow[] };
  error?: string;
  details?: unknown;
};

type RpcTicketRow = {
  id: string;
  reference: string;
  ticket_code: string;
  amount_paid: number;
  quantity: number;
  qr_token: string | null;
  event_title: string;
  tier_name: string;
  venue: string;
  city: string;
  date: string;
  time: string;
};

const STEPS = ["Tickets", "Contact", "Payment"] as const;
const ACCENT = "#1A7A4A";
const ACCENT_LIGHT = "#F4FAF6";
const ACCENT_BORDER = "#d0ead9";

// Inline quantity input with +/- and typed input
function QtyInput({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
}) {
  // Ensure the internal state is always a string representation of a valid number [cite: 10, 11]
  const [inputVal, setInputVal] = useState(String(Number(value) || 0));
  const [error, setError] = useState("");

  useEffect(() => {
    setInputVal(String(Number(value) || 0));
    setError("");
  }, [value]);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (isNaN(n) || n < 0) {
      setError("Invalid number");
      setInputVal(String(Number(value) || 0));
      return;
    }
    if (n > max) {
      setError(`Max ${max} available`);
      setInputVal(String(max));
      onChange(max);
      return;
    }
    setError("");
    onChange(n);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <button
          type="button"
          className="flex h-10 w-9 items-center justify-center text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors disabled:opacity-30"
          onClick={() => onChange(Math.max(0, (Number(value) || 0) - 1))}
          disabled={(Number(value) || 0) <= 0}
        >
          -
        </button>
        <input
          type="number"
          min={0}
          max={max}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit(inputVal)}
          className="w-14 text-center text-sm font-medium text-neutral-900 outline-none border-x border-neutral-200 h-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          className="flex h-10 w-9 items-center justify-center text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-colors disabled:opacity-30"
          onClick={() => onChange(Math.min(max, (Number(value) || 0) + 1))}
          disabled={(Number(value) || 0) >= max}
        >
          +
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function CheckoutPage() {
  const [step, setStep] = useState(0);
  const [paying, setPaying] = useState(false);
  const { items, subtotal, clearCart, updateQuantity, removeItem, addItem } = useCartStore();
  const navigate = useNavigate();
  const { data: events = [], loading: eventsLoading } = useEvents(); // Track loading state [cite: 19]
  const { user, loading: authLoading } = useAuth();
  const [attendee, setAttendee] = useState({ name: "", email: "", phone: "" });

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    event_id?: string | null;
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const fees = 0;

  useEffect(() => {
    if (user?.email) {
      setAttendee((a) => ({ ...a, email: user.email ?? a.email }));
    }
    const meta = user?.user_metadata as { full_name?: string } | undefined;
    if (meta?.full_name) {
      setAttendee((a) => ({ ...a, name: a.name || meta.full_name || "" }));
    }
  }, [user]);

  const itemsByEvent = useMemo(() => {
    const map = new Map<string, { eventId: string; eventTitle: string; items: typeof items }>();
    for (const item of items) {
      const existing = map.get(item.eventId);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(item.eventId, { eventId: item.eventId, eventTitle: item.eventTitle, items: [item] });
      }
    }
    return Array.from(map.values());
  }, [items]);

  const eventObjects = useMemo(() => {
    const map = new Map<string, (typeof events)[number]>();
    for (const ev of events) map.set(ev.id, ev);
    return map;
  }, [events]);

  const lineItems = useMemo(() => items.filter((i) => i.quantity > 0), [items]);

  // Safeguard: Ensure rawSubtotal is always a number [cite: 26]
  const rawSubtotal = Number(subtotal()) || 0;

  let discountAmount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discount_type === 'percentage') {
      discountAmount = rawSubtotal * ((Number(appliedCoupon.discount_value) || 0) / 100);
    } else {
      discountAmount = Number(appliedCoupon.discount_value) || 0;
    }
  }

  const finalTotal = Math.max(0, rawSubtotal + fees - discountAmount);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setValidatingCoupon(true);
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        toast.error("Invalid or expired coupon code");
        setAppliedCoupon(null);
        return;
      }

      const now = new Date();
      if (data.expires_at && new Date(data.expires_at) < now) {
        toast.error("This coupon has expired");
        return;
      }

      if (data.max_uses && data.uses_count >= data.max_uses) {
        toast.error("This coupon has reached its usage limit");
        return;
      }

      if (data.event_id) {
        const cartHasEvent = items.some((i) => i.eventId === data.event_id);
        if (!cartHasEvent) {
          toast.error("This coupon is only valid for a specific event not in your cart");
          return;
        }
      }

      setAppliedCoupon(data);
      toast.success("Coupon applied successfully");
    } catch (err) {
      toast.error("Failed to validate coupon");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const validateAttendee = () => {
    if (!attendee.name.trim()) {
      toast.error("Please enter your full name.");
      return false;
    }
    if (!attendee.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email)) {
      toast.error("Please enter a valid email address.");
      return false;
    }
    if (!attendee.phone.trim()) {
      toast.error("Please enter your phone number.");
      return false;
    }
    if (!isValidPhone(attendee.phone)) {
      toast.error("Please enter a valid Nigerian phone number.");
      return false;
    }
    return true;
  };

  const isValidPhone = (p: string) => {
    const phone = p.trim();
    return /^0\d{10}$/.test(phone) || /^\+234\d{10}$/.test(phone);
  };

  const phoneHasInput = attendee.phone.trim().length > 0;
  const isPhoneError = phoneHasInput && !isValidPhone(attendee.phone);

  const handlePayWithPaystack = () => {
    const supabase = getSupabaseClient();
    const pk = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY?.trim();
    if (!pk) {
      toast.error("Missing VITE_PAYSTACK_PUBLIC_KEY.");
      return;
    }
    if (!supabase || !isSupabaseConfigured) {
      toast.error("Supabase is not configured.");
      return;
    }
    if (!user?.email) {
      toast.error("Sign in to complete payment.");
      navigate("/login", { state: { from: "/checkout" } });
      return;
    }
    if (lineItems.length === 0 || finalTotal <= 0) {
      toast.error("Select at least one ticket.");
      return;
    }

    const reference = generatePaymentReference();
    const amountKobo = nairaToKobo(finalTotal);

    setPaying(true);
    openPaystackInline({
      publicKey: pk,
      email: user.email,
      amountKobo,
      reference,
      onSuccess: (paidRef) => {
        void (async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
              toast.error("Session expired.");
              setPaying(false);
              return;
            }

            const payload: any = {
              reference: paidRef,
              lines: lineItems.map((i) => ({ tier_id: i.tierId, quantity: i.quantity })),
            };
            if (appliedCoupon) payload.coupon_code = appliedCoupon.code;

            const res = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-paystack-payment`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${session.access_token}`,
                  "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify(payload),
              }
            );

            const fnBody = await res.json() as PaystackFnResponse;
            if (!res.ok || !fnBody?.ok) {
              toast.error(fnBody?.error ?? "Could not complete your order.");
              return;
            }

            const tickets: ConfirmationTicket[] = fnBody.data!.tickets.map((t) => ({
              id: t.id,
              reference: t.reference,
              ticketCode: t.ticket_code,
              qrToken: t.qr_token ?? undefined,
              amountPaidKobo: t.amount_paid,
              quantity: t.quantity,
              eventTitle: t.event_title,
              tierName: t.tier_name,
              venue: t.venue,
              city: t.city,
              date: String(t.date),
              time: t.time,
            }));

            clearCart();
            toast.success("Payment successful");
            navigate("/confirmation", {
              state: { tickets, buyerName: attendee.name, buyerEmail: attendee.email, purchasedAt: new Date().toISOString() },
            });
          } catch (e) {
            toast.error("Something went wrong confirming payment.");
          } finally {
            setPaying(false);
          }
        })();
      },
      onCancel: () => setPaying(false),
    });
  };

  const getTierQuantity = (tierId: string) => {
    const item = items.find((i) => i.tierId === tierId);
    return Number(item?.quantity) || 0; // Strict number fallback [cite: 69]
  };

  const setTierQuantity = (tier: TicketTier, qty: number, eventId: string, evTitle: string) => {
    const cleanQty = Math.floor(Number(qty)) || 0;
    if (cleanQty <= 0) {
      removeItem(tier.id);
      return;
    }
    const existing = items.find((i) => i.tierId === tier.id);
    if (existing) {
      updateQuantity(tier.id, cleanQty);
    } else {
      const effectiveMax = (Number(tier.remaining_quantity) || 0) + getTierQuantity(tier.id);
      addItem({
        eventId,
        eventTitle: evTitle,
        tierId: tier.id,
        tierName: tier.name,
        unitPrice: Number(tier.price) || 0,
        maxQuantity: effectiveMax,
        initialQuantity: cleanQty
      });
    }
  };

  const SummaryContent = () => (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      {lineItems.length === 0 ? (
        <p className="text-neutral-400 text-sm">No tickets selected yet.</p>
      ) : (
        <ul className="space-y-4 text-sm">
          {itemsByEvent
            .filter(g => g.items.some(i => i.quantity > 0))
            .map((group) => (
              <li key={group.eventId}>
                <p className="text-sm font-bold text-neutral-900 mb-1.5">{group.eventTitle}</p>
                <ul className="space-y-1 pl-2">
                  {group.items.filter(i => i.quantity > 0).map((item) => (
                    <li key={item.tierId} className="flex justify-between gap-3 text-neutral-600">
                      <span>{item.quantity} × {item.tierName}</span>
                      <span className="shrink-0 tabular-nums">{formatPrice((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0))}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
        </ul>
      )}

      <ul className="mt-4 space-y-3 text-sm">
        <li className="flex justify-between gap-3 text-neutral-500">
          <span className="inline-flex items-center gap-1">Fees<Info className="h-3.5 w-3.5 text-neutral-400" /></span>
          <span className="tabular-nums">{formatPrice(fees)}</span>
        </li>
        <li className="flex justify-between gap-3 border-t border-neutral-100 pt-3 font-medium text-neutral-900">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatPrice(rawSubtotal)}</span>
        </li>
        {appliedCoupon && (
          <li className="flex justify-between gap-3 text-green-600 font-medium">
            <span>Discount ({appliedCoupon.code}) <button onClick={removeCoupon} className="text-xs text-red-500 underline ml-1 font-normal">Remove</button></span>
            <span className="tabular-nums">-{formatPrice(discountAmount)}</span>
          </li>
        )}
      </ul>

      {!appliedCoupon && (
        <div className="mt-4 flex items-center gap-2 border border-neutral-200 rounded-xl px-3 py-2.5">
          <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Discount code" className="flex-1 text-sm outline-none bg-transparent" />
          <button onClick={handleApplyCoupon} disabled={validatingCoupon || !couponCode.trim()} className="text-xs font-semibold" style={{ color: ACCENT }}>
            {validatingCoupon ? "Validating..." : "Apply"}
          </button>
        </div>
      )}

      <div className="mt-4 flex justify-between border-t pt-4 text-base font-bold text-neutral-900" style={{ borderColor: ACCENT_BORDER }}>
        <span>Total</span>
        <span className="tabular-nums" style={{ color: ACCENT }}>{formatPrice(finalTotal)}</span>
      </div>

      {step === 0 && (
        <Button type="button" className="mt-5 h-12 w-full rounded-xl font-semibold text-white" style={{ backgroundColor: finalTotal > 0 ? ACCENT : undefined }} disabled={finalTotal <= 0} onClick={() => setStep(1)}>
          Continue
        </Button>
      )}
    </div>
  );

  // Loading state to prevent NaN during initial fetch [cite: 19]
  if (eventsLoading || authLoading) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground">Initializing checkout...</p>
      </div>
    );
  }

  if (items.length === 0 && step === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground mb-4">Your cart is empty</p>
        <Button onClick={() => navigate("/")} className="text-white" style={{ backgroundColor: ACCENT }}>Browse Events</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <div className="container mx-auto max-w-6xl px-4 py-8 md:py-10">
        {/* Progress indicator */}
        <div className="mb-10 md:mb-14">
          <div className="mx-auto flex max-w-xl items-start justify-between gap-1 sm:gap-2">
            {STEPS.map((label, i) => (
              <Fragment key={label}>
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors",
                      i <= step ? "border-transparent text-white" : "border-neutral-300 bg-white text-neutral-400"
                    )}
                    style={i <= step ? { backgroundColor: ACCENT } : undefined}
                  >
                    {i < step ? <Check className="h-4 w-4" /> : <span>{i + 1}</span>}
                  </div>
                  <span className={cn("text-[10px] font-semibold uppercase sm:text-xs", i <= step ? "text-neutral-900" : "text-neutral-400")}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("mt-[18px] h-0.5 min-w-[1rem] flex-1", i < step ? "" : "bg-neutral-200")} style={i < step ? { backgroundColor: ACCENT } : undefined} />
                )}
              </Fragment>
            ))}
          </div>
        </div>

        {/* STEP 0: Choose Tickets */}
        {step === 0 && (
          <div className="grid gap-8 lg:grid-cols-[1fr_min(100%,380px)] lg:items-start">
            <div className="rounded-2xl bg-white p-5 shadow-sm md:p-8">
              <div className="mb-8 flex items-center gap-3">
                <button type="button" onClick={() => navigate(-1)} className="flex h-11 w-11 items-center justify-center rounded-full text-white" style={{ backgroundColor: ACCENT }}>
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-xl font-bold text-neutral-900 md:text-2xl">Choose Tickets</h1>
              </div>

              <div className="space-y-8">
                {itemsByEvent.map((group) => {
                  const ev = eventObjects.get(group.eventId);
                  return (
                    <div key={group.eventId}>
                      <h3 className="text-base font-bold text-neutral-900 mb-4 pb-2 border-b border-neutral-200">{group.eventTitle}</h3>
                      {ev ? (
                        <ul className="divide-y divide-neutral-100">
                          {ev.ticket_tiers.map((tier) => {
                            const cartQty = getTierQuantity(tier.id);
                            const remaining = (Number(tier.remaining_quantity) || 0) + cartQty;
                            const soldOut = remaining <= 0 && cartQty === 0;
                            console.log(`${tier.name} | DB: ${tier.remaining_quantity} | cart: ${cartQty} | remaining: ${remaining} | soldOut: ${soldOut}`);
                            const qty = cartQty;
                            return (
                              <li key={tier.id} className={cn("flex flex-col gap-4 py-6 sm:flex-row sm:items-start sm:justify-between", soldOut && "opacity-60")}>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <p className="text-sm font-bold uppercase text-neutral-900">{tier.name}</p>
                                  {!soldOut && <p className="text-base font-bold" style={{ color: ACCENT }}>{formatPrice(Number(tier.price) || 0)}</p>}
                                  <p className="text-sm text-neutral-500">{tier.description}</p>
                                </div>
                                <div className="flex shrink-0">
                                  {soldOut ? (
                                    <div className="h-10 min-w-[7rem] flex items-center justify-center rounded-lg bg-neutral-100 text-sm font-medium text-neutral-400">Sold Out</div>
                                  ) : (
                                    <QtyInput
                                      value={qty}
                                      max={remaining}
                                      onChange={(n) => setTierQuantity(tier, n, group.eventId, ev.title)}
                                    />
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <ul className="divide-y divide-neutral-100">
                          {group.items.map((item) => (
                            <li key={item.tierId} className="flex flex-col gap-4 py-6 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold uppercase text-neutral-900">{item.tierName}</p>
                                <p className="text-base font-bold" style={{ color: ACCENT }}>{formatPrice(Number(item.unitPrice) || 0)}</p>
                              </div>
                              <QtyInput
                                value={Number(item.quantity) || 0}
                                max={Number(item.maxQuantity) || 0}
                                onChange={(n) => updateQuantity(item.tierId, n)}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <aside className="lg:sticky lg:top-24">
              <h2 className="mb-3 text-lg font-bold text-neutral-900">Summary</h2>
              <SummaryContent />
            </aside>
          </div>
        )}

        {/* STEP 1: Contact */}
        {step === 1 && (
          <div className="grid gap-8 lg:grid-cols-[1fr_min(100%,380px)] lg:items-start">
            <div className="rounded-2xl bg-white p-6 md:p-8">
              <h2 className="mb-1 text-xl font-bold">Your details</h2>
              <div className="space-y-4 mt-6">
                {(
                  [
                    { label: "Full Name", key: "name" as const, type: "text" },
                    { label: "Email address", key: "email" as const, type: "email" },
                    { label: "Phone Number", key: "phone" as const, type: "tel" },
                  ] as const
                ).map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700">{f.label}</label>
                    <input type={f.type} value={attendee[f.key]} onChange={(e) => setAttendee({ ...attendee, [f.key]: e.target.value })} className={cn("h-11 w-full rounded-xl border bg-white px-4 text-sm outline-none", f.key === "phone" && isPhoneError ? "border-red-500" : "border-neutral-200")} />
                  </div>
                ))}
              </div>
              <div className="mt-8 flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setStep(0)}>Back</Button>
                <Button className="flex-1 rounded-xl text-white" style={{ backgroundColor: ACCENT }} onClick={() => validateAttendee() && setStep(2)}>Continue</Button>
              </div>
            </div>
            <aside><SummaryContent /></aside>
          </div>
        )}

        {/* STEP 2: Payment */}
        {step === 2 && (
          <div className="grid gap-8 lg:grid-cols-[1fr_min(100%,380px)] lg:items-start">
            <div className="rounded-2xl bg-white p-6 md:p-8">
              <h2 className="mb-1 text-xl font-bold">Payment</h2>
              <p className="mb-6 text-sm text-neutral-500">Secured by Paystack. Sign in required.</p>
              <div className="rounded-xl p-4 mb-6 space-y-3" style={{ backgroundColor: ACCENT_LIGHT, border: `1px solid ${ACCENT_BORDER}` }}>
                <div className="flex justify-between border-t pt-2 font-bold text-neutral-900">
                  <span>Total to Pay</span>
                  <span style={{ color: ACCENT }}>{formatPrice(finalTotal)}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setStep(1)} disabled={paying}>Back</Button>
                <Button className="flex-1 rounded-xl text-white" style={{ backgroundColor: ACCENT }} onClick={handlePayWithPaystack} disabled={paying || !user}>
                  {paying ? "Processing..." : `Pay ${formatPrice(finalTotal)}`}
                </Button>
              </div>
            </div>
            <aside><SummaryContent /></aside>
          </div>
        )}
      </div>
    </div>
  );
}
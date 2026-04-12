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
  amount_paid: number;
  quantity: number;
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

const CheckoutPage = () => {
  const [step, setStep] = useState(0);
  const [paying, setPaying] = useState(false);
  const { items, subtotal, clearCart, updateQuantity, removeItem, addItem } = useCartStore();
  const navigate = useNavigate();
  const { data: events = [] } = useEvents();
  const { user, loading: authLoading } = useAuth();
  const [attendee, setAttendee] = useState({ name: "", email: "", phone: "" });

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

  const primaryEventId = items[0]?.eventId ?? null;
  const primaryEventTitle = items[0]?.eventTitle ?? "Your order";

  const event = useMemo(
    () => (primaryEventId ? events.find((e) => e.id === primaryEventId) : undefined),
    [events, primaryEventId],
  );

  const singleEventCart = useMemo(
    () => items.length > 0 && items.every((i) => i.eventId === primaryEventId),
    [items, primaryEventId],
  );

  const lineItems = useMemo(() => items.filter((i) => i.quantity > 0), [items]);

  const total = subtotal() + fees;

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
    return true;
  };

  const handlePayWithPaystack = () => {
    const supabase = getSupabaseClient();
    const pk = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY?.trim();

    if (!pk) {
      toast.error("Missing VITE_PAYSTACK_PUBLIC_KEY. Add it to your environment.");
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
    if (!singleEventCart || !primaryEventId) {
      toast.error("Checkout one event at a time. Clear your cart and add tickets from a single event.");
      return;
    }
    if (lineItems.length === 0 || total <= 0) {
      toast.error("Select at least one ticket.");
      return;
    }

    const reference = generatePaymentReference();
    const amountKobo = nairaToKobo(total);

    setPaying(true);
    openPaystackInline({
      publicKey: pk,
      email: user.email,
      amountKobo,
      reference,
      onSuccess: (paidRef) => {
        void (async () => {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (!session?.access_token) {
              toast.error("Your session expired. Sign in again to complete this payment.");
              setPaying(false);
              return;
            }

            console.log("[checkout] calling edge function with token length:", session.access_token.length);

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

            const res = await fetch(
              `${supabaseUrl}/functions/v1/complete-paystack-payment`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${session.access_token}`,
                  "apikey": supabaseAnonKey,
                },
                body: JSON.stringify({
                  reference: paidRef,
                  lines: lineItems.map((i) => ({ tier_id: i.tierId, quantity: i.quantity })),
                }),
              }
            );

            const fnBody = await res.json() as PaystackFnResponse;
            console.log("[checkout] complete-paystack-payment response:", fnBody);

            if (!res.ok || !fnBody?.ok) {
              const msg = fnBody?.error ?? "Could not complete your order.";
              console.error("[checkout] complete-paystack-payment failed", fnBody);
              toast.error(msg);
              return;
            }

            if (!fnBody.data?.tickets?.length) {
              toast.error("Could not complete your order.");
              return;
            }

            const tickets: ConfirmationTicket[] = fnBody.data.tickets.map((t) => ({
              id: t.id,
              reference: t.reference,
              amountPaidKobo: t.amount_paid,
              quantity: t.quantity,
              eventTitle: t.event_title,
              tierName: t.tier_name,
              venue: t.venue,
              city: t.city,
              date: String(t.date),
              time: t.time,
            }));

            const meta = user.user_metadata as { full_name?: string } | undefined;
            const buyerName =
              attendee.name.trim() || meta?.full_name?.trim() || user.email?.split("@")[0] || "Guest";
            const buyerEmail = attendee.email.trim() || user.email || "";
            const purchasedAt = new Date().toISOString();

            clearCart();
            toast.success("Payment successful");

            // Send confirmation email (non-blocking)
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-ticket-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  type: "ticket_confirmation",
                  buyerName,
                  buyerEmail,
                  eventTitle: tickets[0].eventTitle,
                  tierName: tickets[0].tierName,
                  quantity: tickets[0].quantity,
                  amountPaid: formatPrice(tickets[0].amountPaidKobo / 100),
                  venue: tickets[0].venue,
                  city: tickets[0].city,
                  date: tickets[0].date,
                  time: tickets[0].time,
                  reference: tickets[0].reference,
                  purchasedAt,
                }),
              });
            } catch (emailErr) {
              console.warn("Email send failed (non-blocking):", emailErr);
            }

            navigate("/confirmation", {
              state: { tickets, buyerName, buyerEmail, purchasedAt },
            });
          } catch (e) {
            console.error(e);
            toast.error("Something went wrong confirming payment.");
          } finally {
            setPaying(false);
          }
        })();
      },
      onCancel: () => setPaying(false),
    });
  };

  const getTierQuantity = (tierId: string) => items.find((i) => i.tierId === tierId)?.quantity ?? 0;

  const setTierQuantity = (tier: TicketTier, qty: number, evTitle: string) => {
    if (!primaryEventId) return;
    if (qty <= 0) {
      removeItem(tier.id);
      return;
    }
    const existing = items.find((i) => i.tierId === tier.id);
    if (existing) {
      updateQuantity(tier.id, qty);
    } else {
      addItem({
        eventId: primaryEventId,
        eventTitle: evTitle,
        tierId: tier.id,
        tierName: tier.name,
        unitPrice: tier.price,
      });
      if (qty > 1) updateQuantity(tier.id, qty);
    }
  };

  const maxSelectable = (tier: TicketTier) => Math.min(Math.max(0, tier.remaining_quantity), 10);

  if (items.length === 0 && step === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground mb-4">Your cart is empty</p>
        <Button
          onClick={() => navigate("/")}
          className="text-white"
          style={{ backgroundColor: ACCENT }}
        >
          Browse Events
        </Button>
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
                <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-2 sm:w-auto">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors sm:h-10 sm:w-10",
                      i <= step
                        ? "border-transparent text-white"
                        : "border-neutral-300 bg-white text-neutral-400",
                    )}
                    style={i <= step ? { backgroundColor: ACCENT } : undefined}
                  >
                    {i < step ? (
                      <Check className="h-4 w-4 stroke-[2.5] sm:h-5 sm:w-5" aria-hidden />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-center text-[10px] font-semibold uppercase tracking-wide sm:text-xs sm:normal-case",
                      i <= step ? "text-neutral-900" : "text-neutral-400",
                    )}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mt-[18px] h-0.5 min-w-[1rem] flex-1 sm:mt-5",
                      i < step ? "" : "bg-neutral-200",
                    )}
                    style={i < step ? { backgroundColor: ACCENT } : undefined}
                    aria-hidden
                  />
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
                <button
                  type="button"
                  onClick={() => (primaryEventId ? navigate(`/events/${primaryEventId}`) : navigate(-1))}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-opacity hover:opacity-90"
                  style={{ backgroundColor: ACCENT }}
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-neutral-900 md:text-2xl">Choose Tickets</h1>
                  <p className="text-sm text-neutral-500 mt-0.5">Select the number of tickets for each tier.</p>
                </div>
              </div>

              {singleEventCart && event ? (
                <ul className="divide-y divide-neutral-100">
                  {event.ticket_tiers.map((tier) => {
                    const soldOut = tier.remaining_quantity <= 0;
                    const lowStock = !soldOut && tier.remaining_quantity <= 50;
                    const qty = getTierQuantity(tier.id);
                    const maxQ = maxSelectable(tier);

                    return (
                      <li
                        key={tier.id}
                        className={cn(
                          "flex flex-col gap-4 py-6 first:pt-0 sm:flex-row sm:items-start sm:justify-between",
                          soldOut && "opacity-60",
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-1 pr-2">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold uppercase tracking-wide text-neutral-900">
                              {tier.name}
                            </p>
                            {soldOut && (
                              <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                Sold out
                              </span>
                            )}
                            {lowStock && (
                              <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                {tier.remaining_quantity} left
                              </span>
                            )}
                          </div>
                          {!soldOut && (
                            <p className="text-base font-bold" style={{ color: ACCENT }}>
                              {formatPrice(tier.price)}
                            </p>
                          )}
                          <p className="text-sm leading-relaxed text-neutral-500">{tier.description}</p>
                        </div>

                        <div className="flex shrink-0 sm:pt-1">
                          {soldOut ? (
                            <div className="h-10 min-w-[7rem] flex items-center justify-center rounded-lg bg-neutral-100 border border-neutral-200 text-sm font-medium text-neutral-400">
                              Sold Out
                            </div>
                          ) : (
                            <select
                              aria-label={`Quantity for ${tier.name}`}
                              value={qty}
                              onChange={(e) =>
                                setTierQuantity(tier, Number.parseInt(e.target.value, 10), event.title)
                              }
                              className="h-10 min-w-[5.5rem] rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-offset-1"
                              style={{ "--tw-ring-color": ACCENT } as React.CSSProperties}
                            >
                              {Array.from({ length: maxQ + 1 }, (_, n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul className="divide-y divide-neutral-100">
                  {items.map((item) => (
                    <li
                      key={item.tierId}
                      className="flex flex-col gap-4 py-6 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold uppercase tracking-wide text-neutral-900">{item.tierName}</p>
                        <p className="text-base font-bold" style={{ color: ACCENT }}>
                          {formatPrice(item.unitPrice)}
                        </p>
                        <p className="text-sm text-neutral-500">{item.eventTitle}</p>
                      </div>
                      <select
                        aria-label={`Quantity for ${item.tierName}`}
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.tierId, Number.parseInt(e.target.value, 10))}
                        className="h-10 min-w-[5.5rem] rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium"
                      >
                        {Array.from({ length: 11 }, (_, n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <aside className="lg:sticky lg:top-24">
              <h2 className="mb-3 text-lg font-bold text-neutral-900">Summary</h2>
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="mb-5 text-base font-bold leading-snug text-neutral-900">{primaryEventTitle}</p>
                <ul className="space-y-3 text-sm">
                  {lineItems.length === 0 ? (
                    <li className="text-neutral-400 text-sm">No tickets selected yet.</li>
                  ) : (
                    lineItems.map((item) => (
                      <li key={item.tierId} className="flex justify-between gap-3 text-neutral-600">
                        <span>{item.quantity} × {item.tierName}</span>
                        <span className="shrink-0 tabular-nums">{formatPrice(item.unitPrice * item.quantity)}</span>
                      </li>
                    ))
                  )}
                  <li className="flex justify-between gap-3 text-neutral-500">
                    <span className="inline-flex items-center gap-1">
                      Fees
                      <Info className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                    </span>
                    <span className="tabular-nums">{formatPrice(fees)}</span>
                  </li>
                  <li className="flex justify-between gap-3 border-t border-neutral-100 pt-3 font-medium text-neutral-900">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatPrice(subtotal())}</span>
                  </li>
                </ul>

                <div className="mt-4 flex items-center gap-2 border border-neutral-200 rounded-xl px-3 py-2.5">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-neutral-400 flex-shrink-0">
                    <rect x="1" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M4 4V3a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Discount code"
                    className="flex-1 text-sm outline-none text-neutral-700 placeholder-neutral-400 bg-transparent"
                  />
                  <button className="text-xs font-semibold transition-colors" style={{ color: ACCENT }}>
                    Apply
                  </button>
                </div>

                <div className="mt-4 flex justify-between border-t pt-4 text-base font-bold text-neutral-900" style={{ borderColor: ACCENT_BORDER }}>
                  <span>Total</span>
                  <span className="tabular-nums" style={{ color: ACCENT }}>{formatPrice(total)}</span>
                </div>

                <Button
                  type="button"
                  className="mt-5 h-12 w-full rounded-xl text-base font-semibold text-white shadow-sm transition-all active:scale-[0.98]"
                  style={{ backgroundColor: subtotal() > 0 ? ACCENT : undefined }}
                  disabled={subtotal() <= 0}
                  onClick={() => setStep(1)}
                >
                  Continue
                </Button>
                {subtotal() <= 0 && (
                  <p className="text-center text-xs text-neutral-400 mt-2">Select at least one ticket to continue</p>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* STEP 1: Contact */}
        {step === 1 && (
          <div className="grid gap-8 lg:grid-cols-[1fr_min(100%,380px)] lg:items-start">
            <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
              <h2 className="mb-1 text-xl font-bold text-neutral-900">Your details</h2>
              <p className="text-sm text-neutral-500 mb-6">We'll send your tickets to the email address below.</p>
              <div className="space-y-4">
                {(
                  [
                    { label: "Full Name", key: "name" as const, type: "text", placeholder: "John Doe" },
                    { label: "Email address", key: "email" as const, type: "email", placeholder: "john@example.com" },
                    { label: "Phone Number", key: "phone" as const, type: "tel", placeholder: "+234 800 000 0000" },
                  ] as const
                ).map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700">
                      {f.label} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type={f.type}
                      value={attendee[f.key]}
                      onChange={(e) => setAttendee({ ...attendee, [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      required
                      className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm text-neutral-900 outline-none transition-all focus:border-transparent focus:ring-2"
                      style={{ "--tw-ring-color": ACCENT } as React.CSSProperties}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button type="button" variant="outline" className="h-11 flex-1 border-neutral-200 rounded-xl" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button
                  type="button"
                  className="h-11 flex-1 rounded-xl font-semibold text-white"
                  style={{ backgroundColor: ACCENT }}
                  onClick={() => { if (validateAttendee()) setStep(2); }}
                >
                  Continue to payment
                </Button>
              </div>
            </div>

            <aside className="lg:sticky lg:top-24">
              <h2 className="mb-3 text-lg font-bold text-neutral-900">Summary</h2>
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="mb-4 text-sm font-bold text-neutral-900">{primaryEventTitle}</p>
                <div className="space-y-2">
                  {lineItems.map((item) => (
                    <div key={item.tierId} className="flex justify-between text-sm text-neutral-600">
                      <span>{item.quantity} × {item.tierName}</span>
                      <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-between border-t pt-4 text-base font-bold text-neutral-900" style={{ borderColor: ACCENT_BORDER }}>
                  <span>Total</span>
                  <span style={{ color: ACCENT }}>{formatPrice(total)}</span>
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* STEP 2: Payment */}
        {step === 2 && (
          <div className="grid gap-8 lg:grid-cols-[1fr_min(100%,380px)] lg:items-start">
            <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
              <h2 className="mb-1 text-xl font-bold text-neutral-900">Payment</h2>
              <p className="mb-6 text-sm text-neutral-500">
                A secure Paystack window will open. Sign in is required so we can attach tickets to your account.
              </p>
              {!authLoading && !user && (
                <p className="mb-4 text-sm text-amber-700">
                  <Link to="/login" state={{ from: "/checkout" }} className="font-medium underline">Sign in</Link>{" "}before paying.
                </p>
              )}
              {!import.meta.env.VITE_PAYSTACK_PUBLIC_KEY?.trim() && (
                <p className="mb-4 text-xs text-amber-700">
                  Set <code className="font-mono">VITE_PAYSTACK_PUBLIC_KEY</code> in <code className="font-mono">.env.local</code>.
                </p>
              )}

              <div className="rounded-xl p-4 mb-6 space-y-2" style={{ backgroundColor: ACCENT_LIGHT, border: `1px solid ${ACCENT_BORDER}` }}>
                {lineItems.map((item) => (
                  <div key={item.tierId} className="flex justify-between text-sm text-neutral-700">
                    <span>{item.quantity} × {item.tierName}</span>
                    <span className="font-medium">{formatPrice(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 font-bold text-neutral-900" style={{ borderColor: ACCENT_BORDER }}>
                  <span>Total</span>
                  <span style={{ color: ACCENT }}>{formatPrice(total)}</span>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button type="button" variant="outline" className="h-11 flex-1 border-neutral-200 rounded-xl" onClick={() => setStep(1)} disabled={paying}>
                  Back
                </Button>
                <Button
                  type="button"
                  className="h-11 flex-1 rounded-xl font-semibold text-white active:scale-[0.98] transition-all"
                  style={{ backgroundColor: ACCENT }}
                  onClick={handlePayWithPaystack}
                  disabled={paying || authLoading || !user || total <= 0}
                >
                  {paying ? "Processing…" : `Pay ${formatPrice(total)}`}
                </Button>
              </div>

              <p className="text-center text-xs text-neutral-400 mt-4 flex items-center justify-center gap-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="1" y="4" width="10" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.1"/>
                  <path d="M3.5 4V3a2.5 2.5 0 015 0v1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                </svg>
                Secured by Paystack
              </p>
            </div>

            <aside className="lg:sticky lg:top-24">
              <h2 className="mb-3 text-lg font-bold text-neutral-900">Summary</h2>
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="mb-4 text-sm font-bold text-neutral-900">{primaryEventTitle}</p>
                <div className="space-y-2">
                  {lineItems.map((item) => (
                    <div key={item.tierId} className="flex justify-between text-sm text-neutral-600">
                      <span>{item.quantity} × {item.tierName}</span>
                      <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-between border-t pt-4 text-base font-bold text-neutral-900" style={{ borderColor: ACCENT_BORDER }}>
                  <span>Total</span>
                  <span style={{ color: ACCENT }}>{formatPrice(total)}</span>
                </div>
              </div>
            </aside>
          </div>
        )}

      </div>
    </div>
  );
};

export default CheckoutPage;
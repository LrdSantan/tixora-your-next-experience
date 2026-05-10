import React, { useCallback, useEffect, useState } from "react";
import { Ticket, Plus, Minus, Clock, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { formatPrice } from "@/lib/mock-data";
import type { TicketTier } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { getSupabaseClient } from "@/lib/supabase";
import { toast } from "sonner";

type TicketTiersCarouselProps = {
  tiers: TicketTier[];
  onAddToCart: (tier: TicketTier, qty?: number) => void;
  addedTierId: string | null;
  onHover?: (tier: TicketTier | null) => void;
  eventId: string;
};

// ── Waitlist Modal ────────────────────────────────────────────────
type WaitlistModalProps = {
  tier: TicketTier;
  eventId: string;
  onClose: () => void;
};

function WaitlistModal({ tier, eventId, onClose }: WaitlistModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [position, setPosition] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Not connected");

      const { data, error } = await supabase.functions.invoke("join-waitlist", {
        body: { event_id: eventId, tier_id: tier.id, guest_name: name.trim(), guest_email: email.trim() },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error.includes("already on the waitlist")) {
          toast.error("You're already on the waitlist for this tier.");
        } else {
          toast.error(data.error);
        }
        return;
      }

      setPosition(data.position);
      setSuccess(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to join waitlist");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#0F1612] w-full max-w-sm rounded-[24px] shadow-2xl border border-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-amber-500 px-6 py-5 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-black text-xl tracking-tight leading-tight">Join the Waitlist</h2>
            <p className="text-black/60 text-xs mt-1 font-medium">{tier.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-black/40 hover:text-black transition-colors mt-0.5"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="text-5xl">🎉</div>
              <h3 className="font-bold text-white text-lg">You're on the waitlist!</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                We'll email you if a spot opens up. You'll have{" "}
                <strong className="text-white">24 hours</strong> to claim it.
                {position && (
                  <span className="block mt-3 font-bold text-amber-500 text-base">
                    You are #{position} in line.
                  </span>
                )}
              </p>
              <Button onClick={onClose} className="w-full mt-4 bg-white/5 border-white/10 hover:bg-white/10 text-white" variant="outline">
                Got it
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                We'll email you if a spot opens. You'll have <strong className="text-white">24 hours</strong> to claim it.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wl-name" className="text-xs font-bold uppercase tracking-widest text-white/40">Full Name</Label>
                  <Input
                    id="wl-name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                    className="bg-black/40 border-white/10 text-white h-11 rounded-xl focus:ring-amber-500/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wl-email" className="text-xs font-bold uppercase tracking-widest text-white/40">Email Address</Label>
                  <Input
                    id="wl-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-black/40 border-white/10 text-white h-11 rounded-xl focus:ring-amber-500/50"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold h-11 rounded-xl mt-2 transition-all shadow-lg"
                  disabled={isSubmitting || !name.trim() || !email.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    "Join Waitlist"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Carousel ─────────────────────────────────────────────────
export const TicketTiersCarousel = React.memo(function TicketTiersCarousel({
  tiers,
  onAddToCart,
  addedTierId,
  onHover,
  eventId,
}: TicketTiersCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [waitlistTier, setWaitlistTier] = useState<TicketTier | null>(null);

  const handleQtyChange = (id: string, delta: number, max: number) => {
    setQuantities(prev => {
      const currentQty = prev[id] || 1;
      const nextQty = currentQty + delta;
      return { ...prev, [id]: Math.max(1, Math.min(nextQty, max)) };
    });
  };

  const onSelect = useCallback((instance: CarouselApi) => {
    if (!instance) return;
    setCurrent(instance.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!api) return;
    const sync = () => onSelect(api);
    sync();
    api.on("select", sync);
    api.on("reInit", sync);
    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
    };
  }, [api, onSelect]);

  if (tiers.length === 0) {
    return <p className="text-sm text-muted-foreground">No ticket types available for this event.</p>;
  }

  return (
    <>
      <div className="space-y-3">
        <div className="relative px-0 sm:px-10 md:px-12">
          <Carousel
            setApi={setApi}
            opts={{ align: "start", loop: false, dragFree: false, skipSnaps: false }}
            className="w-full"
          >
            <CarouselContent className="-ml-3 md:-ml-4">
              {tiers.map((tier) => {
                const ratio = tier.total_quantity > 0 ? tier.remaining_quantity / tier.total_quantity : 0;
                const lowStock = tier.remaining_quantity > 0 && ratio > 0 && ratio <= 0.15;
                const soldOut = tier.remaining_quantity <= 0;
                const justAdded = addedTierId === tier.id;
                const showWaitlist = soldOut && tier.waitlist_enabled;

                return (
                  <CarouselItem
                    key={tier.id}
                    className="pl-3 md:pl-4 basis-full sm:basis-[min(100%,18rem)] md:basis-1/2 lg:basis-[44%]"
                    onMouseEnter={() => onHover?.(tier)}
                    onMouseLeave={() => onHover?.(null)}
                  >
                    <div
                      className={cn(
                        "relative flex h-full flex-col rounded-[12px] border bg-[#0F1612] p-5 shadow-sm transition-all duration-300",
                        showWaitlist
                          ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60"
                          : justAdded
                            ? "border-[#2ECC71]/50 bg-[#1A7A4A]/10 shadow-[0_0_15px_rgba(46,204,113,0.1)]"
                            : "border-white/10 hover:border-[#2ECC71]/40 hover:bg-white/[0.02]",
                      )}
                    >
                      {/* Ticket icon top right */}
                      <div className={cn(
                        "absolute right-4 top-4 rounded-xl p-2",
                        showWaitlist ? "bg-amber-500/10 text-amber-500" : "bg-[#1A7A4A]/20 text-[#2ECC71]"
                      )}>
                        <Ticket className="h-4 w-4" aria-hidden />
                      </div>

                      {/* Tier name + description */}
                      <h3 className="pr-12 text-[17px] font-bold text-white leading-tight">{tier.name}</h3>
                      <p className="mt-2 flex-1 text-sm leading-relaxed line-clamp-3" style={{ color: "rgba(255,255,255,0.5)" }}>
                        {tier.description}
                      </p>

                      {/* Stock status */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {soldOut ? (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 bg-red-400/10 px-2 py-0.5 rounded">
                            Sold out
                          </span>
                        ) : lowStock ? (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded">
                            Limited: {tier.remaining_quantity} left
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 bg-white/5 px-2 py-0.5 rounded">
                            Available
                          </span>
                        )}
                        
                        {showWaitlist && (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded flex items-center">
                            <Clock className="w-2.5 h-2.5 mr-1" /> Waitlist
                          </span>
                        )}
                      </div>

                      {/* Price + CTA */}
                      <div className="mt-5 flex flex-col gap-4 border-t border-white/5 pt-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">
                              {tier.price === 0 ? "Price" : "Per Ticket"}
                            </p>
                            <p className="text-2xl font-black tabular-nums" style={{ color: tier.price === 0 ? "#2ECC71" : "#D4A33C" }}>
                              {tier.price === 0 ? "Free" : formatPrice(tier.price)}
                            </p>
                          </div>
                          
                          {!soldOut && (
                            <div className="flex items-center rounded-lg border border-white/10 bg-black/40 overflow-hidden">
                              <button
                                type="button"
                                className="flex h-10 w-9 items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"
                                onClick={() => handleQtyChange(tier.id, -1, tier.remaining_quantity)}
                                disabled={justAdded}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center text-sm font-bold tabular-nums text-white">
                                {quantities[tier.id] || 1}
                              </span>
                              <button
                                type="button"
                                className="flex h-10 w-9 items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"
                                onClick={() => handleQtyChange(tier.id, 1, tier.remaining_quantity)}
                                disabled={justAdded || (quantities[tier.id] || 1) >= tier.remaining_quantity}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {showWaitlist ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setWaitlistTier(tier)}
                            className="w-full text-xs font-bold uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white h-11 rounded-xl shadow-lg transition-all"
                          >
                            <Clock className="w-3.5 h-3.5 mr-2" />
                            Join Waitlist
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={soldOut}
                            onClick={() => onAddToCart(tier, quantities[tier.id] || 1)}
                            className={cn(
                              "w-full text-xs font-bold uppercase tracking-widest h-11 rounded-xl transition-all shadow-lg",
                              justAdded
                                ? "bg-white/10 text-white cursor-default"
                                : "bg-[#2ECC71] text-black hover:bg-[#25B962]",
                            )}
                          >
                            {soldOut ? "Sold Out" : justAdded ? "Added ✓" : "Add to Cart"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>

            {tiers.length > 1 && (
              <>
                <CarouselPrevious
                  variant="outline"
                  className="left-0 top-[42%] z-10 h-9 w-9 -translate-y-1/2 border-border bg-background/95 shadow-md backdrop-blur-sm hover:bg-accent sm:left-1"
                />
                <CarouselNext
                  variant="outline"
                  className="right-0 top-[42%] z-10 h-9 w-9 -translate-y-1/2 border-border bg-background/95 shadow-md backdrop-blur-sm hover:bg-accent sm:right-1"
                />
              </>
            )}
          </Carousel>
        </div>

        {/* Dot indicators */}
        {tiers.length > 1 && (
          <div className="flex justify-center gap-2 pt-1" role="tablist" aria-label="Ticket options">
            {tiers.map((tier, index) => (
              <button
                key={tier.id}
                type="button"
                role="tab"
                aria-selected={current === index}
                aria-label={`${tier.name}, slide ${index + 1} of ${tiers.length}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  current === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                )}
                onClick={() => api?.scrollTo(index)}
              />
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground sm:hidden">Swipe to compare ticket types</p>
      </div>

      {/* Waitlist Modal */}
      {waitlistTier && (
        <WaitlistModal
          tier={waitlistTier}
          eventId={eventId}
          onClose={() => setWaitlistTier(null)}
        />
      )}
    </>
  );
});
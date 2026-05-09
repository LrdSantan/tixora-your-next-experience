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
      <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-amber-500 px-5 py-4 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-white text-lg leading-tight">Join the Waitlist</h2>
            <p className="text-amber-100 text-xs mt-0.5">{tier.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-amber-100 hover:text-white transition-colors mt-0.5"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {success ? (
            <div className="text-center py-4 space-y-3">
              <div className="text-4xl">🎉</div>
              <h3 className="font-bold text-foreground">You're on the waitlist!</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We'll email you if a spot opens up. You'll have{" "}
                <strong>24 hours</strong> to claim it.
                {position && (
                  <span className="block mt-2 font-semibold text-amber-600">
                    You are #{position} in line.
                  </span>
                )}
              </p>
              <Button onClick={onClose} className="w-full mt-2" variant="outline">
                Got it
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                We'll email you if a spot opens. You'll have <strong>24 hours</strong> to claim it.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="wl-name" className="text-sm font-medium">Full Name</Label>
                  <Input
                    id="wl-name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="wl-email" className="text-sm font-medium">Email Address</Label>
                  <Input
                    id="wl-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold mt-1"
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
                        "relative flex h-full flex-col rounded-xl border-2 bg-card p-4 shadow-sm transition-all duration-200",
                        showWaitlist
                          ? "border-amber-200 hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5"
                          : justAdded
                            ? "border-secondary ring-2 ring-secondary/40 shadow-md"
                            : "border-border hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5",
                      )}
                    >
                      {/* Ticket icon top right */}
                      <div className={cn(
                        "absolute right-3 top-3 rounded-full p-1.5",
                        showWaitlist ? "bg-amber-100 text-amber-600" : "bg-primary/10 text-primary"
                      )}>
                        <Ticket className="h-3.5 w-3.5" aria-hidden />
                      </div>

                      {/* Tier name + description */}
                      <h3 className="pr-10 text-base font-bold tracking-tight text-foreground">{tier.name}</h3>
                      <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                        {tier.description}
                      </p>

                      {/* Stock badge */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={soldOut ? "destructive" : lowStock ? "secondary" : "outline"}
                          className="font-normal text-xs px-2 py-0"
                        >
                          {soldOut ? "Sold out" : `${tier.remaining_quantity.toLocaleString()} left`}
                        </Badge>
                        {showWaitlist && (
                          <Badge className="font-normal text-xs px-2 py-0 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                            <Clock className="w-2.5 h-2.5 mr-1" />Waitlist open
                          </Badge>
                        )}
                      </div>

                      {/* Price + CTA */}
                      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{tier.price === 0 ? "Price" : "From"}</p>
                            <p className="text-2xl font-extrabold tabular-nums text-primary">{tier.price === 0 ? "Free" : formatPrice(tier.price)}</p>
                          </div>
                          {!soldOut && (
                            <div className="flex items-center rounded-md border border-neutral-200 bg-white">
                              <button
                                type="button"
                                className="flex h-9 w-8 items-center justify-center text-neutral-500 hover:text-neutral-900 transition-colors"
                                onClick={() => handleQtyChange(tier.id, -1, tier.remaining_quantity)}
                                disabled={justAdded}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center text-sm font-medium tabular-nums">{quantities[tier.id] || 1}</span>
                              <button
                                type="button"
                                className="flex h-9 w-8 items-center justify-center text-neutral-500 hover:text-neutral-900 transition-colors"
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
                            className="w-full text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all"
                          >
                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                            Join Waitlist
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={soldOut}
                            onClick={() => onAddToCart(tier, quantities[tier.id] || 1)}
                            className={cn(
                              "w-full text-sm font-semibold transition-all shadow-sm",
                              justAdded
                                ? "bg-secondary text-secondary-foreground"
                                : "bg-primary text-primary-foreground",
                            )}
                          >
                            {soldOut ? "Sold Out" : justAdded ? "Added ✓" : "Add to cart"}
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
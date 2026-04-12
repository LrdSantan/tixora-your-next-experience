import { useCallback, useEffect, useState } from "react";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { formatPrice } from "@/lib/mock-data";
import type { TicketTier } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type TicketTiersCarouselProps = {
  tiers: TicketTier[];
  onAddToCart: (tier: TicketTier) => void;
  addedTierId: string | null;
  onHover?: (tier: TicketTier | null) => void;
};

export function TicketTiersCarousel({ tiers, onAddToCart, addedTierId, onHover }: TicketTiersCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

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
                      justAdded
                        ? "border-secondary ring-2 ring-secondary/40 shadow-md"
                        : "border-border hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5",
                    )}
                  >
                    {/* Ticket icon top right */}
                    <div className="absolute right-3 top-3 rounded-full bg-primary/10 p-1.5 text-primary">
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
                    </div>

                    {/* Price + CTA */}
                    <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">From</p>
                        <p className="text-2xl font-extrabold tabular-nums text-primary">{formatPrice(tier.price)}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={soldOut}
                        onClick={() => onAddToCart(tier)}
                        className={cn(
                          "shrink-0 min-w-[7rem] text-sm",
                          justAdded
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-primary text-primary-foreground",
                        )}
                      >
                        {soldOut ? "Unavailable" : justAdded ? "Added ✓" : "Add to cart"}
                      </Button>
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
  );
}
import { useParams, useNavigate, Link } from "react-router-dom";
import { MapPin, Calendar, Clock, ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { formatPrice, formatDate } from "@/lib/mock-data";
import { getEventImage } from "@/lib/event-image";
import { useCartStore } from "@/store/cart-store";
import { useState, useEffect } from "react";
import { useEvent } from "@/hooks/use-events";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketTiersCarousel } from "@/components/TicketTiersCarousel";
import type { TicketTier } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { EventReviews } from "@/components/EventReviews";

const SITE_URL = "https://tixora-your-next-experience.vercel.app";

const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: event, isLoading } = useEvent(id);
  const { addItem, items: cartItems } = useCartStore();
  const cartCountForEvent = cartItems
    .filter((i) => i.eventId === id)
    .reduce((sum, i) => sum + i.quantity, 0);
  const [addedTier, setAddedTier] = useState<string | null>(null);
  const [hoveredTier, setHoveredTier] = useState<TicketTier | null>(null);
  const [sidebarQty, setSidebarQty] = useState(1);

  // Reset side bar quantity when hovered tier changes
  useEffect(() => {
    setSidebarQty(1);
  }, [hoveredTier?.id]);

  const todayDateStr = new Date().toISOString().split("T")[0];
  const eventDateStr = event?.date?.includes("T") ? event.date.split("T")[0] : event?.date;
  const isExpired = eventDateStr ? eventDateStr < todayDateStr : false;

  if (isLoading) {
    return (
      <div>
        <Helmet>
          <title>Loading Event | Tixora</title>
        </Helmet>
        <div>
          <Skeleton className="h-64 md:h-96 w-full rounded-none" />
          <div className="container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-10 w-3/4 max-w-lg" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
              <div>
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="flex gap-4 overflow-hidden">
                  <Skeleton className="h-48 w-[280px] rounded-xl flex-shrink-0" />
                  <Skeleton className="h-48 w-[280px] rounded-xl flex-shrink-0" />
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground">Event not found.</p>
        <Button onClick={() => navigate("/")} variant="outline" className="mt-4 border-primary text-primary">
          Go Home
        </Button>
      </div>
    );
  }

  const handleAddToCart = (tier: (typeof event.ticket_tiers)[0], qty?: number) => {
    addItem({
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date,
      tierId: tier.id,
      tierName: tier.name,
      unitPrice: tier.price,
      maxQuantity: tier.remaining_quantity,
      initialQuantity: qty,
    });
    setAddedTier(tier.id);
    setTimeout(() => setAddedTier(null), 1500);
  };

  const lowestPrice = Math.min(...event.ticket_tiers.map((t) => t.price));

  // What the sidebar shows — hovered tier takes priority, otherwise event defaults
  const sidebarTier = hoveredTier;

  const shortDesc = (event.description ?? "").slice(0, 155);
  const ogImage = event.cover_image_url || `${SITE_URL}/og-default.png`;

  return (
    <div>
      <Helmet>
        <title>{event.title} | Tixora</title>
        <meta name="description" content={shortDesc} />
        <meta property="og:title" content={event.title} />
        <meta property="og:description" content={shortDesc} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={`${SITE_URL}/events/${event.id}`} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Tixora" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={event.title} />
        <meta name="twitter:description" content={shortDesc} />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>
      {/* Banner image */}
      <div className="relative h-64 md:h-96 overflow-hidden">
        <img src={getEventImage(event)} alt={event.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-background/80 backdrop-blur rounded-full p-2"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left: main content ── */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary bg-accent px-3 py-1 rounded-full mb-3">
                {event.category}
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">{event.title}</h1>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                {formatDate(event.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                {event.time}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary" />
                {event.venue}, {event.city}
              </span>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-2">About This Event</h2>
              <p className="text-muted-foreground leading-relaxed">{event.description}</p>
            </div>

            {/* Ticket carousel */}
            <div>
              {isExpired ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                  <h2 className="text-xl font-bold text-red-900 mb-2">This event has ended</h2>
                  <p className="text-red-700">Tickets are no longer available for purchase.</p>
                </div>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-foreground mb-1">Select tickets</h2>
                  <p className="text-sm text-muted-foreground mb-5">
                    {event.ticket_tiers.length > 1
                      ? "Hover a tier to preview it, then add to your cart."
                      : "Review the ticket type below and add it to your cart."}
                  </p>
                  <TicketTiersCarousel
                    tiers={event.ticket_tiers}
                    onAddToCart={handleAddToCart}
                    addedTierId={addedTier}
                    onHover={setHoveredTier}
                  />
                  {cartCountForEvent > 0 && (
                    <div className="mt-6 flex justify-center sm:justify-start">
                      <Button asChild className="bg-primary text-primary-foreground font-semibold">
                        <Link to="/checkout">
                          Continue to checkout · {cartCountForEvent} ticket{cartCountForEvent !== 1 ? "s" : ""}
                        </Link>
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Venue */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-2">Venue</h2>
              <div className="bg-card border border-border rounded-xl h-48 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MapPin className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <p className="font-medium">{event.venue}</p>
                  <p className="text-sm">{event.city}, Nigeria</p>
                </div>
              </div>
            </div>
            
            {/* Reviews */}
            <EventReviews eventId={event.id} eventTitle={event.title} />
          </div>

          {/* ── Right: sticky Quick Summary sidebar ── */}
          <div className="hidden lg:block">
            <div className="sticky top-20 bg-card border border-border rounded-xl overflow-hidden shadow-sm">

              {/* Header — always shows event info */}
              <div className="p-6 space-y-3">
                <h3 className="font-bold text-foreground">Quick Summary</h3>
                <div className="text-sm space-y-2 text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Date:</span> {formatDate(event.date)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Time:</span> {event.time}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Venue:</span> {event.venue}
                  </p>
                </div>
              </div>

              {/* Tier preview — animates in when hovering a card */}
              <div
                className={cn(
                  "transition-all duration-300 overflow-hidden",
                  sidebarTier ? "max-h-64 opacity-100" : "max-h-0 opacity-0",
                )}
              >
                {sidebarTier && (
                  <div className="mx-4 mb-4 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {sidebarTier.name}
                      </span>
                      {sidebarTier.remaining_quantity <= 0 ? (
                        <span className="text-xs text-red-500 font-medium">Sold out</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {sidebarTier.remaining_quantity.toLocaleString()} left
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {sidebarTier.description}
                    </p>
                    <p className="text-xl font-extrabold text-primary tabular-nums">
                      {formatPrice(sidebarTier.price)}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <div className="flex items-center rounded-md border border-neutral-200 bg-white">
                        <button
                          type="button"
                          className="flex h-9 w-7 items-center justify-center text-neutral-500 hover:text-neutral-900 transition-colors"
                          onClick={() => setSidebarQty(q => Math.max(1, q - 1))}
                          disabled={sidebarTier.remaining_quantity <= 0}
                        >
                          -
                        </button>
                        <span className="w-5 text-center text-sm font-medium tabular-nums">{sidebarQty}</span>
                        <button
                          type="button"
                          className="flex h-9 w-7 items-center justify-center text-neutral-500 hover:text-neutral-900 transition-colors"
                          onClick={() => setSidebarQty(q => Math.min(10, Math.min(sidebarTier.remaining_quantity, q + 1)))}
                          disabled={sidebarTier.remaining_quantity <= 0 || sidebarQty >= Math.min(10, sidebarTier.remaining_quantity)}
                        >
                          +
                        </button>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={sidebarTier.remaining_quantity <= 0 || isExpired}
                        onClick={() => handleAddToCart(sidebarTier, sidebarQty)}
                        className="flex-1 bg-primary text-primary-foreground text-xs"
                      >
                        {isExpired ? "Event Ended" : (sidebarTier.remaining_quantity <= 0 ? "Unavailable" : "Add to cart")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Default price — hides when tier is hovered */}
              <div
                className={cn(
                  "px-6 pb-6 border-t border-border pt-4 transition-all duration-300",
                  sidebarTier ? "opacity-0 pointer-events-none" : "opacity-100",
                )}
              >
                <p className="text-sm text-muted-foreground">Starting from</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(lowestPrice)}</p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default EventDetailPage;
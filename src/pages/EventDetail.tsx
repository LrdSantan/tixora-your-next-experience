import { useParams, useNavigate } from "react-router-dom";
import { MapPin, Calendar, Clock, ArrowLeft, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EVENTS, formatPrice, formatDate } from "@/lib/mock-data";
import { getEventImage } from "@/components/EventCard";
import { useCartStore } from "@/store/cart-store";
import { useState } from "react";

const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const event = EVENTS.find((e) => e.id === id);
  const { addItem } = useCartStore();
  const [addedTier, setAddedTier] = useState<string | null>(null);

  if (!event) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-muted-foreground">Event not found.</p>
        <Button onClick={() => navigate("/")} variant="outline" className="mt-4 border-primary text-primary">Go Home</Button>
      </div>
    );
  }

  const handleAddToCart = (tier: typeof event.ticket_tiers[0]) => {
    addItem({ eventId: event.id, eventTitle: event.title, tierId: tier.id, tierName: tier.name, unitPrice: tier.price });
    setAddedTier(tier.id);
    setTimeout(() => setAddedTier(null), 1500);
  };

  return (
    <div>
      {/* Banner */}
      <div className="relative h-64 md:h-96 overflow-hidden">
        <img src={getEventImage(event.id)} alt={event.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 bg-background/80 backdrop-blur rounded-full p-2">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-wider text-primary bg-accent px-3 py-1 rounded-full mb-3">
                {event.category}
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">{event.title}</h1>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-primary" />{formatDate(event.date)}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" />{event.time}</span>
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary" />{event.venue}, {event.city}</span>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground mb-2">About This Event</h2>
              <p className="text-muted-foreground leading-relaxed">{event.description}</p>
            </div>

            {/* Ticket Tiers */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-4">Select Tickets</h2>
              <div className="space-y-4">
                {event.ticket_tiers.map((tier) => (
                  <div key={tier.id} className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground">{tier.name}</h3>
                      <p className="text-sm text-muted-foreground">{tier.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{tier.remaining_quantity} remaining</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-bold text-primary">{formatPrice(tier.price)}</p>
                      <Button
                        onClick={() => handleAddToCart(tier)}
                        className={addedTier === tier.id ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"}
                      >
                        {addedTier === tier.id ? "Added ✓" : "Add to Cart"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Map placeholder */}
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
          </div>

          {/* Sidebar - desktop sticky */}
          <div className="hidden lg:block">
            <div className="sticky top-20 bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="font-bold text-foreground">Quick Summary</h3>
              <div className="text-sm space-y-2 text-muted-foreground">
                <p><span className="font-medium text-foreground">Date:</span> {formatDate(event.date)}</p>
                <p><span className="font-medium text-foreground">Time:</span> {event.time}</p>
                <p><span className="font-medium text-foreground">Venue:</span> {event.venue}</p>
              </div>
              <div className="pt-2 border-t border-border">
                <p className="text-sm text-muted-foreground">Starting from</p>
                <p className="text-2xl font-bold text-primary">
                  {formatPrice(Math.min(...event.ticket_tiers.map((t) => t.price)))}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailPage;

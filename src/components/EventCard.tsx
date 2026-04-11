import { Link } from "react-router-dom";
import { MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, formatDate, type Event } from "@/lib/mock-data";

// Image imports
import concert1 from "@/assets/event-concert-1.jpg";
import concert2 from "@/assets/event-concert-2.jpg";
import sports1 from "@/assets/event-sports-1.jpg";
import sports2 from "@/assets/event-sports-2.jpg";
import comedy from "@/assets/event-comedy.jpg";
import festival from "@/assets/event-festival.jpg";

const EVENT_IMAGES: Record<string, string> = {
  "1": concert1,
  "2": concert2,
  "3": sports1,
  "4": sports2,
  "5": comedy,
  "6": festival,
};

export function getEventImage(eventId: string): string {
  return EVENT_IMAGES[eventId] || concert1;
}

interface EventCardProps {
  event: Event;
}

const EventCard = ({ event }: EventCardProps) => {
  const lowestPrice = Math.min(...event.ticket_tiers.map((t) => t.price));

  return (
    <Link to={`/events/${event.id}`} className="group block">
      <div className="bg-card rounded-xl overflow-hidden border border-border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
        <div className="aspect-[16/10] overflow-hidden">
          <img
            src={getEventImage(event.id)}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            width={800}
            height={512}
          />
        </div>
        <div className="p-4 space-y-2">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-primary bg-accent px-2.5 py-1 rounded-full">
            {event.category}
          </span>
          <h3 className="font-bold text-foreground text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {event.title}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span>{event.venue}, {event.city}</span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm font-bold text-primary">From {formatPrice(lowestPrice)}</p>
            <Button size="sm" className="bg-primary text-primary-foreground text-xs h-8 px-3">
              Get Tickets
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default EventCard;

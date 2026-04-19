import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Calendar, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, formatDate, type Event } from "@/lib/mock-data";
import { formatEventDateDisplay } from "@/lib/date-utils";
import { getEventImage } from "@/lib/event-image";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface EventCardProps {
  event: Event;
}

const EventCard = React.memo(({ event }: EventCardProps) => {
  const [copied, setCopied] = useState(false);
  const lowestPrice = Math.min(...event.ticket_tiers.map((t) => t.price));

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const url = `https://tixoraafrica.com.ng/events/${event.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Event link copied!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  return (
    <Link to={`/events/${event.id}`} className="group block h-full">
      <div className="bg-card rounded-xl overflow-hidden border border-border hover:shadow-lg transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
        <div className="aspect-[16/10] overflow-hidden flex-shrink-0 bg-muted relative">
          <img
            src={getEventImage(event)}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 absolute inset-0"
            loading="lazy"
            width={800}
            height={512}
          />
          <div className="absolute top-2 right-2 flex flex-col items-end gap-2">
            {event.is_multi_day && (
              <Badge className="bg-primary text-primary-foreground border-none font-bold text-[10px] px-2 py-0.5 shadow-sm uppercase tracking-tighter">
                Multi-day
              </Badge>
            )}
            <button
              onClick={handleCopy}
              className="p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-neutral-200 text-neutral-600 hover:text-primary hover:bg-white transition-all active:scale-95"
              title="Copy event link"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="p-4 flex flex-col flex-1">
          <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-primary bg-accent px-2.5 py-1 rounded-full w-fit">
            {event.category}
          </span>
          {/* Title always takes exactly 2 lines worth of space */}
          <h3 className="font-bold text-foreground text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors mt-2 min-h-[2.5rem]">
            {event.title}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{formatEventDateDisplay(event.date, event.is_multi_day || false, event.event_days || [])}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="line-clamp-1">{event.venue}, {event.city}</span>
          </div>
          {/* Push price + button to bottom of card always */}
          <div className="flex items-center justify-between pt-3 mt-auto border-t border-border">
            <p className="text-sm font-bold text-primary">From {formatPrice(lowestPrice)}</p>
            <Button size="sm" className="bg-primary text-primary-foreground text-xs h-8 px-3">
              Get Tickets
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
});

EventCard.displayName = "EventCard";

export default EventCard; 
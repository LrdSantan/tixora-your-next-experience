import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Calendar, Copy, Check, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, type Event } from "@/lib/mock-data";
import { formatEventDateDisplay } from "@/lib/date-utils";
import { getEventImage } from "@/lib/event-image";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CATEGORY_COLORS, type EventCategory } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface EventCardProps {
  event: Event;
}

const EventCard = React.memo(({ event }: EventCardProps) => {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  
  // Calculate lowest price from tiers
  const lowestPrice = event.ticket_tiers && event.ticket_tiers.length > 0
    ? Math.min(...event.ticket_tiers.map((t) => t.price))
    : 0;

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const url = `${window.location.origin}/events/${event.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Event link copied!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  const categoryColor = CATEGORY_COLORS[event.category as EventCategory] || CATEGORY_COLORS['Other'];

  return (
    <Link to={`/events/${event.id}`} className="group block h-full">
      <div className="bg-card rounded-2xl overflow-hidden border border-border hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full flex flex-col">
        {/* Cover Image */}
        <div className="aspect-[16/9] overflow-hidden flex-shrink-0 bg-muted relative">
          {(event.cover_image_url || event.cover_image) && !imgError ? (
            <img
              src={event.cover_image_url || event.cover_image || getEventImage(event)}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 absolute inset-0"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <Calendar className="w-10 h-10 text-primary/40" />
            </div>
          )}
          
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center bg-white/95 backdrop-blur-sm text-neutral-900 text-[11px] font-bold px-3 py-1.5 rounded-full shadow-sm">
              {event.category || 'Event'}
            </span>
          </div>
          
          <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
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

          {/* Tickets Sold Badge */}
          {event.quantity_sold > 0 && (
            <div className="absolute bottom-3 left-3">
              <Badge className="bg-black/60 backdrop-blur-md text-white border-none flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase">
                <TrendingUp className="w-3 h-3" />
                {event.quantity_sold.toLocaleString()} Sold
              </Badge>
            </div>
          )}
        </div>

        <div className="p-5 flex flex-col flex-1">
          {/* Title */}
          <h3 className="font-bold text-foreground text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors min-h-[3rem]">
            {event.title}
          </h3>

          {/* Details */}
          <div className="space-y-2 mt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">
                {formatEventDateDisplay(event.date, event.is_multi_day || false, event.event_days || [])}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">{event.venue}, {event.city}</span>
            </div>
          </div>

          {/* Bottom section */}
          <div className="flex items-center justify-between pt-4 mt-auto border-t border-neutral-100">
            <div className="flex flex-col">
              <span className="text-[11px] text-muted-foreground font-medium mb-0.5">From</span>
              <p className={cn(
                "text-base font-extrabold",
                lowestPrice === 0 ? "text-green-600" : "text-foreground"
              )}>
                {lowestPrice === 0 ? "Free" : formatPrice(lowestPrice)}
              </p>
            </div>
            <Button size="sm" className="bg-[#0F9D58] hover:bg-[#0F9D58]/90 text-white font-bold rounded-full px-5 h-9">
              Buy Tickets
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
});

EventCard.displayName = "EventCard";

export default EventCard;
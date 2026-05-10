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
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);
  
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
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  };

  return (
    <Link to={`/events/${event.id}`} className="group block h-full w-full">
      <div className="bg-[#0F1612] rounded-[16px] overflow-hidden border border-white/5 transition-all duration-500 hover:border-[#1A7A4A]/40 h-full flex flex-col w-full relative">
        {/* Copy Link Button */}
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-all active:scale-90"
          title="Copy event link"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-[#2ECC71]" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
        {/* Cover Image */}
        <div className="aspect-[16/9] w-full overflow-hidden flex-shrink-0 relative bg-[#0d1a10]">
          {(event.cover_image_url || event.cover_image) && !imgError ? (
            <>
              <img
                src={event.cover_image_url || event.cover_image || getEventImage(event)}
                alt={event.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                loading="lazy"
                onError={() => setImgError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F1612] via-transparent to-transparent opacity-80" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Calendar className="w-10 h-10 text-white/10" />
            </div>
          )}
          
          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center bg-[#1A7A4A] text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest rounded-full shadow-lg">
              {event.category || 'Event'}
            </span>
          </div>
        </div>

        <div className="p-5 flex flex-col flex-1 space-y-4">
          {/* Title */}
          <h3 
            className="font-bold text-white text-[16px] leading-snug transition-colors line-clamp-2 min-h-[2.5rem]"
          >
            {event.title}
          </h3>

          {/* Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              <Calendar className="w-3.5 h-3.5 text-[#1A7A4A] shrink-0" />
              <span className="truncate">
                {formatEventDateDisplay(event.date, event.is_multi_day || false, event.event_days || [])}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              <MapPin className="w-3.5 h-3.5 text-[#1A7A4A] shrink-0" />
              <span className="truncate">{event.venue}, {event.city}</span>
            </div>
          </div>

          {/* Bottom section */}
          <div className="flex items-center justify-between pt-4 mt-auto border-t border-white/5">
            <div className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-tighter" style={{ color: "rgba(255,255,255,0.4)" }}>From</span>
              <p className="text-[18px] font-bold" style={{ color: lowestPrice === 0 ? "#2ECC71" : "#D4A33C" }}>
                {lowestPrice === 0 ? "Free" : formatPrice(lowestPrice)}
              </p>
            </div>
            <Button className="bg-[#1A7A4A] hover:bg-[#1A7A4A]/90 text-white font-bold rounded-full px-5 h-9 text-xs transition-all active:scale-95">
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
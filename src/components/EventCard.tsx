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
    <Link to={`/events/${event.id}`} className="group block w-full">
      <div className="bg-[#0F1612] rounded-[16px] overflow-hidden border border-white/5 transition-all duration-500 hover:border-[#1A7A4A]/40 flex flex-col w-full relative max-h-[280px]">
        {/* Copy Link Button */}
        <button
          onClick={handleCopy}
          className="absolute top-2.5 right-2.5 z-20 p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-all active:scale-90"
          title="Copy event link"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-[#2ECC71]" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
        {/* Cover Image */}
        <div className="h-[120px] w-full overflow-hidden flex-shrink-0 relative bg-[#0d1a10]">
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
          
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
            <span className="inline-flex items-center bg-[#1A7A4A] text-white text-[9px] font-bold px-2 py-0.5 uppercase tracking-widest rounded-full shadow-lg">
              {event.category || 'Event'}
            </span>
            {event.event_type === 'rsvp' && (
              <span className="inline-flex items-center bg-[#2ECC71] text-black text-[9px] font-black px-2 py-0.5 uppercase tracking-tighter rounded-full shadow-lg">
                RSVP Only
              </span>
            )}
          </div>
        </div>

        <div className="p-4 flex flex-col space-y-3">
          {/* Title */}
          <h3 
            className="font-bold text-white text-[15px] leading-snug transition-colors line-clamp-1"
          >
            {event.title}
          </h3>

          {/* Details */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              <Calendar className="w-3 h-3 text-[#1A7A4A] shrink-0" />
              <span className="truncate">
                {formatEventDateDisplay(event.date, event.is_multi_day || false, event.event_days || [])}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              <MapPin className="w-3 h-3 text-[#1A7A4A] shrink-0" />
              <span className="truncate">{event.venue}, {event.city}</span>
            </div>
          </div>

          {/* Organizer row */}
          {(event.organizer_name || event.organizer_avatar) && (
            <div className="flex items-center gap-1.5 pt-1">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-white/5 shrink-0 border border-white/10">
                {event.organizer_avatar ? (
                  <img src={event.organizer_avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-white/20">
                    {event.organizer_name?.charAt(0)}
                  </div>
                )}
              </div>
              <span className="text-[11px] font-medium truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
                {event.organizer_name}
              </span>
            </div>
          )}

          {/* Bottom section */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <div className="flex flex-col">
              <span className="text-[10px] font-medium uppercase tracking-tighter" style={{ color: "rgba(255,255,255,0.4)" }}>
                {event.event_type === 'rsvp' ? "Entry" : "From"}
              </span>
              <p className="text-[16px] font-bold" style={{ color: (event.event_type === 'rsvp' || lowestPrice === 0) ? "#2ECC71" : "#D4A33C" }}>
                {event.event_type === 'rsvp' ? "Free RSVP" : (lowestPrice === 0 ? "Free" : formatPrice(lowestPrice))}
              </p>
            </div>
            <Button className="bg-[#1A7A4A] hover:bg-[#1A7A4A]/90 text-white font-bold rounded-full px-4 h-8 text-[11px] transition-all active:scale-95">
              {event.event_type === 'rsvp' ? "Reserve Spot" : "Buy Tickets"}
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
});

EventCard.displayName = "EventCard";

export default EventCard;
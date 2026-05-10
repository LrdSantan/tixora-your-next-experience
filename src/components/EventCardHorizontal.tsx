import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Calendar, ArrowRight } from "lucide-react";
import { formatPrice, type Event } from "@/lib/mock-data";
import { formatEventDateDisplay } from "@/lib/date-utils";
import { getEventImage } from "@/lib/event-image";
import { cn } from "@/lib/utils";

interface EventCardHorizontalProps {
  event: Event;
}

export const EventCardHorizontal = React.memo(({ event }: EventCardHorizontalProps) => {
  const [imgError, setImgError] = useState(false);
  
  // Calculate lowest price from tiers
  const lowestPrice = event.ticket_tiers && event.ticket_tiers.length > 0
    ? Math.min(...event.ticket_tiers.map((t) => t.price))
    : 0;

  return (
    <Link to={`/events/${event.id}`} className="group block w-full">
      <div className="bg-[#0F1612] rounded-[12px] p-3 border border-white/5 transition-all duration-300 hover:border-[#1A7A4A]/40 flex gap-4 items-center">
        {/* Left: Thumbnail */}
        <div className="w-20 h-20 md:w-[100px] md:h-[100px] shrink-0 overflow-hidden rounded-[10px] bg-[#0d1a10]">
          {(event.cover_image_url || event.cover_image) && !imgError ? (
            <img
              src={event.cover_image_url || event.cover_image || getEventImage(event)}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white/10" />
            </div>
          )}
        </div>

        {/* Right: Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-block bg-[#1A7A4A] text-white text-[9px] font-bold px-2 py-0.5 uppercase tracking-widest rounded-full">
              {event.category || 'Event'}
            </span>
          </div>
          
          <h3 className="font-bold text-white text-[14px] md:text-[15px] leading-tight truncate">
            {event.title}
          </h3>

          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              <Calendar className="w-3 h-3 text-[#1A7A4A] shrink-0" />
              <span className="truncate">
                {formatEventDateDisplay(event.date, event.is_multi_day || false, event.event_days || [])}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
              <MapPin className="w-3 h-3 text-[#1A7A4A] shrink-0" />
              <span className="truncate">{event.venue}, {event.city}</span>
            </div>
          </div>

          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-tighter" style={{ color: "rgba(255,255,255,0.4)" }}>From</span>
            <span className="text-[13px] font-bold" style={{ color: lowestPrice === 0 ? "#2ECC71" : "#D4A33C" }}>
              {lowestPrice === 0 ? "Free" : formatPrice(lowestPrice)}
            </span>
          </div>
        </div>

        {/* Far Right: CTA */}
        <div className="hidden sm:flex items-center gap-1 text-[#2ECC71] text-[12px] font-bold group-hover:translate-x-1 transition-transform">
          Buy Tickets <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Link>
  );
});

EventCardHorizontal.displayName = "EventCardHorizontal";

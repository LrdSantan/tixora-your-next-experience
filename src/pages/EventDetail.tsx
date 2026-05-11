import { useParams, useNavigate, Link } from "react-router-dom";
import { MapPin, Calendar, Clock, ArrowLeft, Tag, Minus, Plus } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { formatPrice, formatDate } from "@/lib/mock-data";
import { formatEventDateDisplay } from "@/lib/date-utils";
import { getEventImage } from "@/lib/event-image";
import { useCartStore } from "@/store/cart-store";
import { useState, useEffect } from "react";
import { useEvent } from "@/hooks/use-events";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketTiersCarousel } from "@/components/TicketTiersCarousel";
import type { TicketTier } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { EventReviews } from "@/components/EventReviews";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateCalendarLinks, downloadIcs } from "@/lib/calendar";
import { useAuth } from "@/contexts/auth-context";
import { getSupabaseClient } from "@/lib/supabase";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SITE_URL = "https://tixoraafrica.com.ng";

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
  const { user } = useAuth();
  const supabase = getSupabaseClient();
  const [sidebarQty, setSidebarQty] = useState(1);
  
  // RSVP Form state
  const [rsvpName, setRsvpName] = useState("");
  const [rsvpEmail, setRsvpEmail] = useState("");
  const [isRsvping, setIsRsvping] = useState(false);
  const [rsvpSuccess, setRsvpSuccess] = useState(false);

  // Pre-fill RSVP form if user is logged in
  useEffect(() => {
    if (user) {
      setRsvpEmail(user.email || "");
      const fullName = (user.user_metadata as any)?.full_name || "";
      setRsvpName(fullName);
    }
  }, [user]);

  // Reset side bar quantity when hovered tier changes
  useEffect(() => {
    setSidebarQty(1);
  }, [hoveredTier?.id]);

  const todayDateStr = new Date().toISOString().split("T")[0];
  const eventDateStr = event?.date?.includes("T") ? event.date.split("T")[0] : event?.date;
  const isExpired = eventDateStr ? eventDateStr < todayDateStr : false;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080C0A]">
        <Helmet>
          <title>Loading Event | Tixora</title>
        </Helmet>
        <div>
          <Skeleton className="h-80 w-full rounded-none bg-white/5" />
          <div className="container mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 relative -mt-12">
            <div className="lg:col-span-2 space-y-8">
              <div className="space-y-4">
                <Skeleton className="h-6 w-24 rounded-full bg-white/10" />
                <Skeleton className="h-12 w-3/4 max-w-lg bg-white/10" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-4 w-24 bg-white/5" />
                <Skeleton className="h-4 w-24 bg-white/5" />
                <Skeleton className="h-4 w-32 bg-white/5" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/4 bg-white/10" />
                <Skeleton className="h-4 w-full bg-white/5" />
                <Skeleton className="h-4 w-full bg-white/5" />
                <Skeleton className="h-4 w-2/3 bg-white/5" />
              </div>
              <div>
                <Skeleton className="h-6 w-32 mb-4 bg-white/10" />
                <div className="flex gap-4 overflow-hidden">
                  <Skeleton className="h-64 w-[280px] rounded-2xl flex-shrink-0 bg-white/5" />
                  <Skeleton className="h-64 w-[280px] rounded-2xl flex-shrink-0 bg-white/5" />
                </div>
              </div>
            </div>
            <div className="hidden lg:block">
              <Skeleton className="h-96 w-full rounded-2xl bg-white/5" />
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

  const handleRsvp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !event) return;
    if (!rsvpName.trim() || !rsvpEmail.trim()) {
      toast.error("Please fill in your name and email.");
      return;
    }

    try {
      setIsRsvping(true);
      const { data, error } = await supabase.rpc('submit_rsvp', {
        p_event_id: event.id,
        p_user_id: user?.id || null,
        p_name: rsvpName,
        p_email: rsvpEmail
      });

      if (error) {
        if (error.message.includes('fully_booked')) throw new Error("This event is fully booked.");
        if (error.message.includes('already_rsvpd')) throw new Error("You have already RSVP'd for this event.");
        throw error;
      }

      // Success! Trigger email
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      fetch(`${baseUrl}/functions/v1/send-ticket-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: data.reference })
      }).catch(err => console.error("Email trigger failed:", err));

      setRsvpSuccess(true);
      toast.success("RSVP confirmed! Check your email.");
    } catch (err: any) {
      toast.error(err.message || "Failed to RSVP. Please try again.");
    } finally {
      setIsRsvping(false);
    }
  };

  const lowestPrice = Math.min(...(event.ticket_tiers?.map((t) => t.price) || [0]));
  const rsvpTier = event.event_type === 'rsvp' ? event.ticket_tiers?.[0] : null;

  // What the sidebar shows — hovered tier takes priority, otherwise event defaults
  const sidebarTier = hoveredTier;

  const shortDesc = (event.description ?? "").slice(0, 155);
  const ogImage = event.cover_image_url || `${SITE_URL}/og-default.png`;

  const handleCalendar = (type: 'google' | 'outlook' | 'apple') => {
    if (!event) return;
    
    const links = generateCalendarLinks({
      title: event.title,
      description: `${event.title} on Tixora. Get your tickets at tixoraafrica.com.ng`,
      location: `${event.venue}, ${event.city}`,
      startDate: String(event.date),
      startTime: event.time,
    });

    if (type === 'google') window.open(links.googleUrl, '_blank');
    else if (type === 'outlook') window.open(links.outlookUrl, '_blank');
    else if (type === 'apple') downloadIcs(event.title, links.icsContent);
  };

  return (
    <div className="min-h-screen bg-[#080C0A] text-white">
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
      <div className="relative h-80 overflow-hidden">
        <img src={getEventImage(event)} alt={event.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080C0A] via-transparent to-transparent" />
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-black/40 backdrop-blur-md rounded-full p-2 border border-white/10 hover:bg-black/60 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="container mx-auto px-4 py-8 relative -mt-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Left: main content ── */}
          <div className="lg:col-span-2 space-y-8">
            <div className="space-y-4">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-white bg-[#1A7A4A] px-4 py-1.5 rounded-[100px]">
                {event.category}
              </span>
              <h1 className="text-[32px] font-extrabold text-white leading-tight">{event.title}</h1>
              
              <div className="flex flex-wrap gap-5 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#1A7A4A]" />
                  {formatEventDateDisplay(event.date, event.is_multi_day || false, event.event_days || [])}
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#1A7A4A]" />
                  {event.time}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#1A7A4A]" />
                  {event.venue}, {event.city}
                </span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-3 text-[11px] font-bold uppercase tracking-wide gap-1.5 text-[#2ECC71] hover:text-[#2ECC71] hover:bg-[#2ECC71]/10 transition-colors border border-[#2ECC71]/20 rounded-full">
                      <Calendar className="w-3 h-3" />
                      Add to Calendar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-[#0F1612] border-white/10 text-white">
                    <DropdownMenuItem onClick={() => handleCalendar('google')} className="hover:bg-white/5 cursor-pointer">
                      Google Calendar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCalendar('outlook')} className="hover:bg-white/5 cursor-pointer">
                      Outlook Calendar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCalendar('apple')} className="hover:bg-white/5 cursor-pointer">
                      Apple Calendar / ICS
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div>
              <h2 className="text-[18px] font-bold text-white mb-[12px]">About This Event</h2>
              <p className="text-[15px] leading-[1.8]" style={{ color: "rgba(255,255,255,0.7)" }}>
                {event.description}
              </p>
            </div>

            {/* Ticket selection OR RSVP Form */}
            <div className="space-y-4 pt-4">
              {isExpired ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
                  <h2 className="text-xl font-bold text-red-400 mb-2">This event has ended</h2>
                  <p className="text-red-300/70">Registrations are no longer available.</p>
                </div>
              ) : event.event_type === 'rsvp' ? (
                <div className="space-y-6">
                  {rsvpSuccess ? (
                    <div className="p-8 rounded-2xl bg-[#1A7A4A]/10 border border-[#1A7A4A]/20 text-center space-y-4 animate-in zoom-in-95 duration-500">
                      <div className="w-16 h-16 bg-[#1A7A4A] rounded-full flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(26,122,74,0.3)]">
                        <Check className="w-8 h-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-white">You're on the list!</h2>
                        <p className="text-[#2ECC71] mt-1 font-medium">Confirmation sent to {rsvpEmail}</p>
                      </div>
                      <p className="text-sm text-white/50 max-w-xs mx-auto">
                        We've sent your RSVP details and access code to your email. See you at the event!
                      </p>
                      <Button variant="outline" onClick={() => setRsvpSuccess(false)} className="border-white/10 text-white/60 hover:text-white hover:bg-white/5">
                        Register another guest
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-[#0F1612] border border-white/10 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl">
                      <div className="space-y-1">
                        <h2 className="text-[20px] font-bold text-white flex items-center gap-2">
                          ✋ Free RSVP Entry
                        </h2>
                        <p className="text-sm text-white/40">Enter your details to reserve your spot. It's completely free!</p>
                      </div>

                      <form onSubmit={handleRsvp} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="rsvp-name" className="text-xs font-bold uppercase tracking-wider text-white/50">Full Name</Label>
                            <Input 
                              id="rsvp-name"
                              placeholder="John Doe" 
                              className="bg-black/40 border-white/10 h-12 focus:border-[#2ECC71]/50 focus:ring-[#2ECC71]/20"
                              value={rsvpName}
                              onChange={e => setRsvpName(e.target.value)}
                              disabled={isRsvping}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="rsvp-email" className="text-xs font-bold uppercase tracking-wider text-white/50">Email Address</Label>
                            <Input 
                              id="rsvp-email"
                              type="email"
                              placeholder="john@example.com" 
                              className="bg-black/40 border-white/10 h-12 focus:border-[#2ECC71]/50 focus:ring-[#2ECC71]/20"
                              value={rsvpEmail}
                              onChange={e => setRsvpEmail(e.target.value)}
                              disabled={isRsvping || !!user}
                            />
                          </div>
                        </div>

                        <div className="pt-2">
                          <Button 
                            type="submit" 
                            disabled={isRsvping || (rsvpTier?.remaining_quantity ?? 0) <= 0}
                            className="w-full h-14 bg-[#1A7A4A] hover:bg-[#15613a] text-white font-black text-lg rounded-xl shadow-[0_10px_20px_rgba(26,122,74,0.2)] transition-all hover:-translate-y-0.5 active:translate-y-0"
                          >
                            {isRsvping ? "Processing..." : (rsvpTier?.remaining_quantity ?? 0) <= 0 ? "Fully Booked" : "Reserve My Spot →"}
                          </Button>
                          
                          {rsvpTier && rsvpTier.remaining_quantity < 50 && rsvpTier.remaining_quantity > 0 && (
                            <p className="text-center text-xs text-orange-400 mt-4 font-bold animate-pulse uppercase tracking-widest">
                              Hurry! Only {rsvpTier.remaining_quantity} spots left
                            </p>
                          )}
                          {rsvpTier && rsvpTier.remaining_quantity <= 0 && (
                            <p className="text-center text-xs text-red-400 mt-4 font-bold uppercase tracking-widest">
                              Registration Closed · Event Full
                            </p>
                          )}
                        </div>
                      </form>

                      <div className="pt-4 border-t border-white/5 text-center">
                        <p className="text-[11px] text-white/30 uppercase tracking-widest font-bold">Powered by Tixora</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="text-[18px] font-bold text-white">Select tickets</h2>
                    <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {event.ticket_tiers.length > 1
                        ? "Hover a tier to preview it, then add to your cart."
                        : "Review the ticket type below and add it to your cart."}
                    </p>
                  </div>
                  
                  <TicketTiersCarousel
                    tiers={event.ticket_tiers}
                    onAddToCart={handleAddToCart}
                    addedTierId={addedTier}
                    onHover={setHoveredTier}
                    eventId={event.id}
                  />
                  
                  {cartCountForEvent > 0 && (
                    <div className="mt-8 flex justify-center sm:justify-start">
                      <Button asChild className="bg-[#2ECC71] text-black hover:bg-[#25B962] font-bold px-8 h-12 text-base rounded-xl transition-all shadow-[0_0_20px_rgba(46,204,113,0.2)]">
                        <Link to="/checkout">
                          Continue to checkout · {cartCountForEvent} ticket{cartCountForEvent !== 1 ? "s" : ""}
                        </Link>
                      </Button>
                    </div>
                  )}

                  <div className="mt-10 rounded-2xl bg-[rgba(212,163,60,0.05)] p-5 border border-[rgba(212,163,60,0.15)] flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex gap-4">
                      <div className="p-2.5 bg-[rgba(212,163,60,0.1)] rounded-xl shrink-0">
                        <Tag className="h-5 w-5 text-[#D4A33C]" />
                      </div>
                      <div>
                        <p className="text-[15px] font-bold text-[#D4A33C]">Looking for a specific tier?</p>
                        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>Check our secure marketplace for fan-to-fan resales.</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild className="bg-transparent border-[#D4A33C]/30 text-[#D4A33C] hover:bg-[#D4A33C]/10 hover:border-[#D4A33C] transition-all rounded-xl px-6">
                      <Link to="/marketplace">View Marketplace</Link>
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="pt-6">
              <h2 className="text-[18px] font-bold text-white mb-4">Venue Location</h2>
              <div className="bg-[#0F1612] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 bg-white/5">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-[#1A7A4A]/20 rounded-xl shrink-0">
                      <MapPin className="w-5 h-5 text-[#2ECC71]" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg leading-tight">{event.venue}</p>
                      <p className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>{event.city}, Nigeria</p>
                    </div>
                  </div>
                </div>
                
                <div className="relative group">
                  <iframe
                    title="Venue Map"
                    width="100%"
                    height="320"
                    style={{ border: 0, filter: "invert(90%) hue-rotate(180deg) brightness(0.8) contrast(1.2)" }}
                    loading="lazy"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(`${event.venue}, ${event.city}`)}&output=embed`}
                    allowFullScreen
                    className="opacity-80 transition-opacity group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 pointer-events-none border-y border-white/5" />
                </div>

                <div className="p-5 bg-white/5 flex justify-end">
                  <Button asChild className="bg-[#1A7A4A] hover:bg-[#15613a] text-white gap-2 font-bold px-6 rounded-xl transition-all shadow-lg">
                    <a 
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${event.venue}, ${event.city}`)}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <MapPin className="w-4 h-4" />
                      Open in Maps
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            {/* Reviews */}
            <div className="pt-8">
              <EventReviews eventId={event.id} eventTitle={event.title} />
            </div>
          </div>

          {/* ── Right: sticky Quick Summary sidebar ── */}
          <div className="hidden lg:block">
            <div className="sticky top-24 bg-[#0F1612] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">

              {/* Header — always shows event info */}
              <div className="p-6 space-y-5">
                <h3 className="font-bold text-white text-lg border-b border-white/5 pb-4">Quick Summary</h3>
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Date</span>
                    <span className="font-semibold text-white">
                      {formatEventDateDisplay(event.date, event.is_multi_day || false, event.event_days || [])}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Time</span>
                    <span className="font-semibold text-white">{event.time}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[12px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>Venue</span>
                    <span className="font-semibold text-white">{event.venue}</span>
                  </div>
                </div>
              </div>

              {/* Tier preview — animates in when hovering a card */}
              <div
                className={cn(
                  "transition-all duration-500 overflow-hidden",
                  sidebarTier ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0",
                )}
              >
                {sidebarTier && (
                  <div className="mx-6 mb-6 rounded-2xl border border-[#2ECC71]/20 bg-[#2ECC71]/5 p-5 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-widest text-[#2ECC71] bg-[#2ECC71]/10 px-2 py-0.5 rounded">
                        {sidebarTier.name}
                      </span>
                      {sidebarTier.remaining_quantity <= 0 ? (
                        <span className="text-xs text-red-400 font-bold uppercase tracking-tighter">Sold out</span>
                      ) : (
                        <span className="text-[11px] font-bold text-white/40 uppercase">
                          {sidebarTier.remaining_quantity.toLocaleString()} left
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {sidebarTier.description}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-3xl font-black tabular-nums" style={{ color: sidebarTier.price === 0 ? "#2ECC71" : "#D4A33C" }}>
                        {sidebarTier.price === 0 ? "Free" : formatPrice(sidebarTier.price)}
                      </p>
                      {sidebarTier.price > 0 && <span className="text-xs font-bold text-white/20">/ TICKET</span>}
                    </div>
                    <div className="flex gap-3 mt-2">
                      <div className="flex items-center rounded-xl border border-white/10 bg-black/40 overflow-hidden">
                        <button
                          type="button"
                          className="flex h-11 w-10 items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"
                          onClick={() => setSidebarQty(q => Math.max(1, q - 1))}
                          disabled={sidebarTier.remaining_quantity <= 0}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-6 text-center text-sm font-bold tabular-nums text-white">{sidebarQty}</span>
                        <button
                          type="button"
                          className="flex h-11 w-10 items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-all"
                          onClick={() => setSidebarQty(q => Math.min(sidebarTier.remaining_quantity, q + 1))}
                          disabled={sidebarTier.remaining_quantity <= 0 || sidebarQty >= sidebarTier.remaining_quantity}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <Button
                        type="button"
                        size="lg"
                        disabled={sidebarTier.remaining_quantity <= 0 || isExpired}
                        onClick={() => handleAddToCart(sidebarTier, sidebarQty)}
                        className="flex-1 bg-[#2ECC71] text-black hover:bg-[#25B962] font-bold text-sm rounded-xl h-11 transition-all"
                      >
                        {isExpired ? "Expired" : (sidebarTier.remaining_quantity <= 0 ? "Waitlist" : "Add to Cart")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Default price — hides when tier is hovered */}
              <div
                className={cn(
                  "px-6 pb-6 border-t border-white/5 pt-5 transition-all duration-500 bg-white/5",
                  sidebarTier ? "opacity-0 pointer-events-none translate-y-4" : "opacity-100 translate-y-0",
                )}
              >
                <p className="text-[12px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {event.event_type === 'rsvp' ? "Entry" : (lowestPrice === 0 ? "Price" : "Starting from")}
                </p>
                <p className="text-3xl font-black" style={{ color: (event.event_type === 'rsvp' || lowestPrice === 0) ? "#2ECC71" : "#D4A33C" }}>
                  {event.event_type === 'rsvp' ? "Free RSVP" : (lowestPrice === 0 ? "Free" : formatPrice(lowestPrice))}
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
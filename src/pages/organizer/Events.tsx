import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, Plus, MapPin, Calendar, Ticket, Share2, Landmark, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/contexts/auth-context";
import { getSupabaseClient } from "@/lib/supabase";
import { formatDate, formatPrice } from "@/lib/mock-data";
import { formatEventDateDisplay } from "@/lib/date-utils";
import { getEventImage } from "@/lib/event-image";
import { EditCoverImageButton } from "@/components/EditCoverImageButton";
import { cn } from "@/lib/utils";

const NIGERIAN_BANKS = [
  "Access Bank", "GTBank", "First Bank", "Zenith Bank", "UBA",
  "Sterling Bank", "Fidelity Bank", "Polaris Bank", "Union Bank",
  "Wema Bank", "Stanbic IBTC", "FCMB", "Ecobank", "Keystone Bank",
  "Jaiz Bank", "Opay", "Palmpay", "Kuda Bank", "Moniepoint"
].sort();

type OrganizerEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  category: string;
  cover_image_url: string | null;
  status: string;
  created_at: string;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  is_multi_day: boolean | null;
  event_days: string[] | null;
  ticket_tiers: Array<{
    id: string;
    name: string;
    price: number;
    total_quantity: number;
    remaining_quantity: number;
  }>;
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  suspended: "bg-amber-100 text-amber-700 border-amber-200",
  pending: "bg-blue-100 text-blue-700 border-blue-200",
  expired: "bg-neutral-100 text-neutral-500 border-neutral-200",
  deleted: "bg-red-100 text-red-600 border-red-200",
};

const ADMIN_EMAIL = "yusufquadir50@gmail.com";
const SITE_URL = "https://tixoraafrica.com.ng";

function OrganizerPayoutModal({ event, onSuccess }: { event: OrganizerEvent, onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [bankSearchOpen, setBankSearchOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = getSupabaseClient();
  
  const [formData, setFormData] = useState({
    bankName: event.bank_name || "",
    accountNumber: event.account_number || "",
    accountName: event.account_name || ""
  });

  const isValid = formData.bankName && formData.accountNumber.length === 10 && formData.accountName;

  const handleUpdate = async () => {
    if (!supabase || !isValid) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          bank_name: formData.bankName,
          account_number: formData.accountNumber,
          account_name: formData.accountName
        })
        .eq("id", event.id);

      if (error) throw error;
      toast.success("Payout details updated!");
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to update payout details");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3 border-border hover:bg-muted" title="Manage Payout">
          <Landmark className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payout Details: {event.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bank Name</label>
            <Popover open={bankSearchOpen} onOpenChange={setBankSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={bankSearchOpen}
                  className="w-full justify-between h-10 px-3 font-normal"
                >
                  {formData.bankName ? formData.bankName : "Search bank..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search bank..." />
                  <CommandList>
                    <CommandEmpty>No bank found.</CommandEmpty>
                    <CommandGroup>
                      {NIGERIAN_BANKS.map((bank) => (
                        <CommandItem
                          key={bank}
                          value={bank}
                          onSelect={(currentValue) => {
                            setFormData({ ...formData, bankName: currentValue });
                            setBankSearchOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.bankName === bank ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {bank}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Account Number</label>
            <Input 
              placeholder="10 digits" 
              maxLength={10} 
              value={formData.accountNumber} 
              onChange={e => setFormData({ ...formData, accountNumber: e.target.value.replace(/\D/g, "") })} 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Account Name</label>
            <Input 
              placeholder="Name on account" 
              value={formData.accountName} 
              onChange={e => setFormData({ ...formData, accountName: e.target.value })} 
            />
          </div>

          <Button 
            className="w-full mt-4" 
            disabled={!isValid || isSubmitting}
            onClick={handleUpdate}
          >
            {isSubmitting ? "Saving..." : "Save Payout Details"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function OrganizerEventsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const supabase = getSupabaseClient();

  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleShare = (event: OrganizerEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${SITE_URL}/events/${event.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Event link copied to clipboard!");
    }).catch(() => {
      // Fallback for browsers that block clipboard in non-secure contexts
      toast.error("Could not copy link — please copy it manually.");
    });
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?redirect=/organizer/events");
  }, [user, authLoading, navigate]);

  const fetchEvents = () => {
    if (!user || authLoading || !supabase) return;
    setIsLoading(true);

    supabase
      .from("events")
      .select(
        `id, title, date, time, venue, city, category, cover_image_url, status, created_at,
         bank_name, account_number, account_name, is_multi_day, event_days,
         ticket_tiers ( id, name, price, total_quantity, remaining_quantity )`
      )
      .eq("organizer_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Failed to load your events");
        else setEvents((data ?? []) as OrganizerEvent[]);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchEvents();
  }, [user, authLoading, supabase]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-5 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
              <Skeleton className="aspect-[16/9] w-full rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            My Events
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Events you've created on Tixora.</p>
        </div>
        <Button asChild className="bg-primary text-primary-foreground gap-2 shrink-0">
          <Link to="/create-event">
            <Plus className="w-4 h-4" />
            Create Event
          </Link>
        </Button>
      </div>

      {/* Loading skeletons */}
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
              <Skeleton className="aspect-[16/9] w-full rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        /* Empty state */
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-20 text-center">
          <CalendarDays className="w-14 h-14 text-primary mx-auto mb-5 opacity-60" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            You haven't created any events yet
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
            Get started by creating your first event — set up tiers, accept payments, and manage attendees all in one place.
          </p>
          <Button asChild className="bg-primary text-primary-foreground gap-2">
            <Link to="/create-event">
              <Plus className="w-4 h-4" />
              Create Event
            </Link>
          </Button>
        </div>
      ) : (
        /* Events grid */
        <div className="grid gap-5 sm:grid-cols-2">
          {events.map((event) => {
            const totalSold = event.ticket_tiers.reduce(
              (sum, t) => sum + (t.total_quantity - t.remaining_quantity),
              0
            );
            const totalCapacity = event.ticket_tiers.reduce((sum, t) => sum + t.total_quantity, 0);
            const lowestPrice = event.ticket_tiers.length > 0
              ? Math.min(...event.ticket_tiers.map((t) => t.price))
              : null;
            const statusClass = STATUS_STYLES[event.status] ?? STATUS_STYLES.pending;

            return (
              <div
                key={event.id}
                className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 duration-200 flex flex-col"
              >
                {/* Cover image — clicking navigates to the event */}
                <Link to={`/events/${event.id}`} className="block">
                  <div className="aspect-[16/9] overflow-hidden relative bg-muted">
                    <img
                      src={event.cover_image_url || `https://source.unsplash.com/800x450/?${event.category}`}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <span
                      className={`absolute top-2 right-2 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${statusClass}`}
                    >
                      {event.status}
                    </span>
                  </div>
                </Link>

                {/* Details */}
                <div className="p-4 flex flex-col flex-1">
                  <Link to={`/events/${event.id}`}>
                    <h3 className="font-bold text-foreground text-base leading-snug line-clamp-2 hover:text-primary transition-colors">
                      {event.title}
                    </h3>
                  </Link>

                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{formatEventDateDisplay(event.date, event.is_multi_day || false, event.event_days || [])} · {event.time}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="line-clamp-1">{event.venue}, {event.city}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Ticket className="w-3.5 h-3.5" />
                      {totalSold} / {totalCapacity} sold
                    </span>
                    {lowestPrice !== null && (
                      <span className="font-semibold text-primary">
                        From {formatPrice(lowestPrice)}
                      </span>
                    )}
                  </div>

                  {/* Actions row */}
                  <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                    <EditCoverImageButton 
                      eventId={event.id} 
                      onSuccess={fetchEvents}
                      className="flex-1"
                    />
                    <OrganizerPayoutModal event={event} onSuccess={fetchEvents} />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 px-3 border-border hover:bg-muted"
                      onClick={(e) => handleShare(event, e)}
                      title="Share Event"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Quick Share buttons */}
                  <div className="mt-2.5 flex items-center justify-center gap-3">
                      {/* WhatsApp */}
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Check out this event: ${event.title} ${SITE_URL}/events/${event.id}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-border text-muted-foreground hover:text-green-600 hover:border-green-100 hover:bg-green-50 transition-all duration-200"
                        title="Share on WhatsApp"
                      >
                        <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L.054 23.446a.5.5 0 0 0 .613.613l5.63-1.476A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.667-.513-5.195-1.41l-.372-.217-3.853 1.01 1.027-3.749-.237-.384A9.96 9.96 0 0 1 2 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z"/>
                        </svg>
                      </a>

                      {/* Twitter / X */}
                      <a
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this event: ${event.title}`)}&url=${encodeURIComponent(`${SITE_URL}/events/${event.id}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground hover:bg-neutral-50 transition-all duration-200"
                        title="Share on X / Twitter"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

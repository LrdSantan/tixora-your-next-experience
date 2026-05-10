import { ArrowRight, CalendarRange } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import EventCard from "@/components/EventCard";
import { EventCardHorizontal } from "@/components/EventCardHorizontal";
import { useEvents } from "@/hooks/use-events";
import { Skeleton } from "@/components/ui/skeleton";
import { useCallback, useMemo, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { EventCardSkeleton } from "@/components/EventCardSkeleton";
import { filterEvents, parseDatePreset, type DateFilterPreset } from "@/lib/event-filters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventSearchInput } from "@/components/EventSearchInput";
import { IndexScanAccess } from "@/components/IndexScanAccess";
import { EVENT_CATEGORIES, CATEGORY_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

function EventsEmptyState({
  onClear,
  showClear,
  noData,
}: {
  onClear: () => void;
  showClear: boolean;
  noData: boolean;
}) {
  return (
    <div
      className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-6 py-14 text-center max-w-lg mx-auto"
      role="status"
    >
      <CalendarRange className="w-12 h-12 text-[#1A7A4A] mx-auto mb-4 opacity-80" />
      <h3 className="text-lg font-semibold text-white mb-2">
        {noData ? "No events available" : "No events match your filters"}
      </h3>
      <p className="text-sm text-white/50 mb-6">
        {noData
          ? "Check back soon for new shows and experiences."
          : "Try a different search, pick another category or date range, or clear filters to see everything again."}
      </p>
      {showClear && (
        <Button type="button" variant="outline" className="border-[#1A7A4A] text-[#2ECC71] hover:bg-[#1A7A4A]/10" onClick={onClear}>
          Clear all filters
        </Button>
      )}
    </div>
  );
}

const HomePage = () => {
  const browseRef = useRef<HTMLElement>(null);
  const { data: events = [], isLoading, isError } = useEvents();
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const categoryFromUrl = searchParams.get("cat");
  const selectedCategory =
    categoryFromUrl && EVENT_CATEGORIES.includes(categoryFromUrl as any) ? categoryFromUrl : null;
  const datePreset: DateFilterPreset = parseDatePreset(searchParams.get("when"));

  const setQuery = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, val] of Object.entries(updates)) {
            if (val === undefined || val === null || val === "") next.delete(key);
            else next.set(key, val);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const filteredEvents = useMemo(
    () =>
      filterEvents(events, {
        search: q,
        category: selectedCategory,
        datePreset,
      }),
    [events, q, selectedCategory, datePreset],
  );

  // Trending events: top 6 by quantity_sold, active, and not private
  const trendingEvents = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return events
      .filter(e => e.status === 'active' && !e.is_private && new Date(e.date) >= today)
      .sort((a, b) => (b.quantity_sold || 0) - (a.quantity_sold || 0))
      .slice(0, 6);
  }, [events]);

  const hasActiveFilters = Boolean(q.trim() || selectedCategory || datePreset !== "all");
  const showEmpty = !isLoading && !isError && filteredEvents.length === 0;
  const noData = events.length === 0;

  const scrollToBrowse = () => {
    browseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="bg-[#080C0A] min-h-screen text-white">
      <Helmet>
        <title>Tixora — Book Events in Nigeria</title>
        <meta name="description" content="Discover and book tickets for the best events in Nigeria. Concerts, sports, food festivals and more on Tixora." />
      </Helmet>
      
      <section className="relative overflow-hidden text-white" style={{ minHeight: '600px' }}>
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/tixora-hero-bg.png')" }}
        />
        <div className="absolute inset-0 z-0 bg-[#080C0A]/75" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-[#0F9D58]/20 blur-[120px] rounded-[100%] z-0 pointer-events-none" />
        
        <div className="container mx-auto px-4 py-24 md:py-32 text-center space-y-6 relative z-10 flex flex-col items-center justify-center min-h-[600px]">
          <h1 className="text-4xl md:text-6xl lg:text-[4.5rem] font-extrabold leading-tight animate-fade-in-up px-2 drop-shadow-xl max-w-4xl mx-auto text-white">
            Your Next Experience<br className="hidden sm:block" />Starts Here
          </h1>
          <p
            className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto font-medium drop-shadow-md"
            style={{ animationDelay: "0.1s", animation: "fade-in-up 0.6s ease-out 0.1s forwards", opacity: 0 }}
          >
            Discover and book the best concerts, sports, comedy shows, and festivals across Nigeria.
          </p>
          <div
            className="flex flex-col sm:flex-row items-center gap-3 max-w-2xl mx-auto pt-4 w-full"
            style={{ animationDelay: "0.2s", animation: "fade-in-up 0.6s ease-out 0.2s forwards", opacity: 0 }}
          >
            <EventSearchInput
              variant="hero"
              className="flex-1 w-full"
              value={q}
              events={events}
              onChange={(v) => setQuery({ q: v || null })}
              placeholder="Search events, cities..."
              aria-label="Search events by name, city, or venue"
            />
            <Button
              type="button"
              className="bg-[#0F9D58] hover:bg-[#0F9D58]/90 text-white font-bold h-[52px] px-8 rounded-full w-full sm:w-auto text-base shadow-lg"
              onClick={scrollToBrowse}
            >
              Find Events <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
          <IndexScanAccess />
        </div>
      </section>

      <section ref={browseRef} id="browse-events" className="container mx-auto px-4 py-12 scroll-mt-20">
        <h2 className="text-2xl font-bold text-white mb-6">Browse by Category</h2>
        <div className="flex flex-wrap gap-3 mb-8">
          {EVENT_CATEGORIES.map((name) => {
            const selected = selectedCategory === name;
            return (
              <button
                key={name}
                type="button"
                aria-pressed={selected}
                onClick={() => setQuery({ cat: selected ? null : name })}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 rounded-full border transition-all group",
                  selected
                    ? "bg-[#1A7A4A] text-white border-[#1A7A4A] shadow-lg"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    selected ? "text-white" : "text-white/60 group-hover:text-white transition-colors"
                  )}
                >
                  {name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between mb-2">
          <div className="space-y-1.5">
            <label htmlFor="event-date-filter" className="text-xs font-bold uppercase tracking-widest text-white/40">
              When
            </label>
            <Select
              value={datePreset}
              onValueChange={(v) => setQuery({ when: v === "all" ? null : v })}
            >
              <SelectTrigger id="event-date-filter" className="w-full sm:w-[220px] bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Any date" />
              </SelectTrigger>
              <SelectContent className="bg-[#0F1612] border-white/10 text-white">
                <SelectItem value="all">All dates</SelectItem>
                <SelectItem value="upcoming">Upcoming (from today)</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="next_90_days">Next 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {isLoading ? (
        <section className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        </section>
      ) : isError ? (
        <section className="container mx-auto px-4 py-8">
          <p className="text-sm text-muted-foreground">Could not load events.</p>
        </section>
      ) : showEmpty ? (
        <section className="container mx-auto px-4 py-8 pb-16">
          <EventsEmptyState
            noData={noData}
            showClear={hasActiveFilters && !noData}
            onClear={() => setQuery({ q: null, cat: null, when: null })}
          />
        </section>
      ) : (
        <>
          {/* Trending Section */}
          {!hasActiveFilters && trendingEvents.length > 0 && (
            <div className="bg-[#080C0A] py-[60px]">
              <section className="container mx-auto px-4 max-w-7xl">
                <div className="flex items-center justify-between mb-[32px]">
                  <h2 className="text-[28px] font-[800] text-white">Trending Events</h2>
                  <Link to="/discover" className="hidden md:block text-sm text-[#2ECC71] font-bold hover:underline tracking-tight">
                    View All
                  </Link>
                </div>
                <div className="-mx-4 px-4 flex flex-row gap-4 overflow-x-auto pb-6 md:pb-0 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:gap-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:display-none">
                  {trendingEvents.map((event) => (
                    <div key={event.id} className="min-w-[280px] md:min-w-0 flex-shrink-0">
                      <EventCard event={event} />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Regular Grid */}
          <div className="bg-[#080C0A] py-[60px]">
            <section className="container mx-auto px-4 max-w-7xl">
              <div className="flex items-center justify-between mb-[32px]">
                <h2 className="text-[28px] font-[800] text-white">
                  {hasActiveFilters ? "Search Results" : "Upcoming Events"}
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {filteredEvents.map((event) => (
                  <EventCardHorizontal key={event.id} event={event} />
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default HomePage;

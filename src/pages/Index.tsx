import { ArrowRight, Music, Trophy, Theater, Laugh, PartyPopper, CalendarRange } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import EventCard from "@/components/EventCard";
import { useEvents } from "@/hooks/use-events";
import { Skeleton } from "@/components/ui/skeleton";
import { useCallback, useMemo, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { EventCardSkeleton } from "@/components/EventCardSkeleton";
import { filterEvents, parseDatePreset, type DateFilterPreset } from "@/lib/event-filters";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventSearchInput } from "@/components/EventSearchInput";

const CATEGORIES = [
  { name: "Concerts", icon: Music },
  { name: "Sports", icon: Trophy },
  { name: "Theatre", icon: Theater },
  { name: "Comedy", icon: Laugh },
  { name: "Festivals", icon: PartyPopper },
] as const;

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
      className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center max-w-lg mx-auto"
      role="status"
    >
      <CalendarRange className="w-12 h-12 text-primary mx-auto mb-4 opacity-80" />
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {noData ? "No events available" : "No events match your filters"}
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        {noData
          ? "Check back soon for new shows and experiences."
          : "Try a different search, pick another category or date range, or clear filters to see everything again."}
      </p>
      {showClear && (
        <Button type="button" variant="outline" className="border-primary text-primary" onClick={onClear}>
          Clear all filters
        </Button>
      )}
    </div>
  );
}



const HomePage = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const browseRef = useRef<HTMLElement>(null);
  const { data: events = [], isLoading, isError } = useEvents();
  const [searchParams, setSearchParams] = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const categoryFromUrl = searchParams.get("cat");
  const selectedCategory =
    categoryFromUrl && CATEGORIES.some((c) => c.name === categoryFromUrl) ? categoryFromUrl : null;
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

  const hasActiveFilters = Boolean(q.trim() || selectedCategory || datePreset !== "all");
  const showEmpty = !isLoading && !isError && filteredEvents.length === 0;
  const noData = events.length === 0;

  const scrollToBrowse = () => {
    browseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <Helmet>
        <title>Tixora — Book Events in Nigeria</title>
        <meta name="description" content="Discover and book tickets for the best events in Nigeria. Concerts, sports, food festivals and more on Tixora." />
        <meta property="og:title" content="Tixora — Book Events in Nigeria" />
        <meta property="og:description" content="Discover and book tickets for the best events in Nigeria." />
        <meta property="og:image" content="https://tixora-your-next-experience.vercel.app/favicon-32x32.png?v=2" />
        <meta property="og:url" content="https://tixora-your-next-experience.vercel.app" />
      </Helmet>
      <section className="bg-hero text-primary-foreground">
        <div className="container mx-auto px-4 py-20 md:py-28 text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight animate-fade-in-up">
            Your Next Experience<br />Starts Here
          </h1>
          <p
            className="text-base md:text-lg text-primary-foreground/70 max-w-xl mx-auto"
            style={{ animationDelay: "0.1s", animation: "fade-in-up 0.6s ease-out 0.1s forwards", opacity: 0 }}
          >
            Discover and book the best concerts, sports, comedy shows, and festivals across Nigeria.
          </p>
          <div
            className="flex flex-col sm:flex-row items-center gap-3 max-w-xl mx-auto"
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
              className="bg-secondary text-secondary-foreground font-semibold h-12 px-6 rounded-full whitespace-nowrap"
              onClick={scrollToBrowse}
            >
              Find Events <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      <section ref={browseRef} id="browse-events" className="container mx-auto px-4 py-12 scroll-mt-20">
        <h2 className="text-2xl font-bold text-foreground mb-6">Browse by Category</h2>
        <div className="flex flex-wrap gap-3 mb-8">
          {CATEGORIES.map(({ name, icon: Icon }) => {
            const selected = selectedCategory === name;
            return (
              <button
                key={name}
                type="button"
                aria-pressed={selected}
                onClick={() => setQuery({ cat: selected ? null : name })}
                className={`flex items-center gap-2 px-5 py-3 rounded-full border transition-all group ${
                  selected
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background border-border hover:bg-accent hover:border-primary/30"
                }`}
              >
                <Icon className={`w-4 h-4 ${selected ? "text-primary-foreground" : "text-primary"}`} />
                <span
                  className={`text-sm font-medium ${
                    selected ? "text-primary-foreground" : "text-foreground group-hover:text-primary transition-colors"
                  }`}
                >
                  {name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between mb-2">
          <div className="space-y-1">
            <label htmlFor="event-date-filter" className="text-sm font-medium text-foreground">
              When
            </label>
            <Select
              value={datePreset}
              onValueChange={(v) => setQuery({ when: v === "all" ? null : v })}
            >
              <SelectTrigger id="event-date-filter" className="w-full sm:w-[220px] bg-background">
                <SelectValue placeholder="Any date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dates</SelectItem>
                <SelectItem value="upcoming">Upcoming (from today)</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
                <SelectItem value="next_90_days">Next 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isLoading && !isError && (
            <p className="text-sm text-muted-foreground">
              {filteredEvents.length === events.length
                ? `${filteredEvents.length} event${filteredEvents.length === 1 ? "" : "s"}`
                : `${filteredEvents.length} of ${events.length} event${events.length === 1 ? "" : "s"}`}
            </p>
          )}
        </div>
      </section>

      {isLoading ? (
        <>
          <section className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Featured Events</h2>
            </div>
            <div className="flex gap-5 overflow-x-auto pb-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="min-w-[280px] w-[320px] max-w-[320px] flex-shrink-0 animate-pulse">
                  <EventCardSkeleton />
                </div>
              ))}
            </div>
          </section>
          <section className="container mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Upcoming Events</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <EventCardSkeleton key={i} />
              ))}
            </div>
          </section>
        </>
      ) : isError ? (
        <section className="container mx-auto px-4 py-8">
          <p className="text-sm text-muted-foreground">Could not load events. Showing cached or offline data if available.</p>
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
          <section className="container mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Featured Events</h2>
              <Link to="/" className="text-sm text-primary font-medium hover:underline">
                View All
              </Link>
            </div>
            <div
              ref={scrollRef}
              className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
              style={{ scrollbarWidth: "none" }}
            >
              {filteredEvents.slice(0, 4).map((event) => (
                <div key={event.id} className="min-w-[280px] max-w-[320px] snap-start flex-shrink-0">
                  <EventCard event={event} />
                </div>
              ))}
            </div>
          </section>

          <section className="container mx-auto px-4 py-12">
            <h2 className="text-2xl font-bold text-foreground mb-6">Upcoming Events</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default HomePage;

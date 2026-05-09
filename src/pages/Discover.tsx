import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, MapPin, Calendar, TrendingUp, Loader2, Filter } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useEvents } from "@/hooks/use-events";
import EventCard from "@/components/EventCard";
import { EventCardSkeleton } from "@/components/EventCardSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";

type DateRangePreset = "today" | "this_week" | "this_weekend" | "this_month" | "all";

export default function DiscoverPage() {
  const { data: events = [], isLoading, isError } = useEvents();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Local state for UI responsiveness before searchParams update
  const [cityInput, setCityInput] = useState(searchParams.get("city") || "");
  const [pageSize, setPageSize] = useState(12);

  const category = searchParams.get("category") || "all";
  const dateRange = (searchParams.get("date") as DateRangePreset) || "all";
  const city = searchParams.get("city") || "";

  // Update URL params
  const setFilter = useCallback((key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== "all") {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      return next;
    }, { replace: true });
    setPageSize(12); // Reset page size on filter change
  }, [setSearchParams]);

  // Debounced city search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilter("city", cityInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [cityInput, setFilter]);

  // Filter Logic
  const filteredEvents = useMemo(() => {
    let result = events.filter(e => e.status === 'active' && !e.is_private);
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Upcoming only
    result = result.filter(e => new Date(e.date) >= today);

    // Category Filter
    if (category !== "all") {
      result = result.filter(e => e.category === category);
    }

    // City Filter
    if (city) {
      result = result.filter(e => 
        e.city.toLowerCase().includes(city.toLowerCase()) || 
        e.venue.toLowerCase().includes(city.toLowerCase())
      );
    }

    // Date Filter
    if (dateRange !== "all") {
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      result = result.filter(e => {
        const eventDate = new Date(e.date);
        if (dateRange === "today") {
          return eventDate.toDateString() === today.toDateString();
        }
        if (dateRange === "this_week") {
          return eventDate >= today && eventDate <= endOfWeek;
        }
        if (dateRange === "this_weekend") {
          const day = eventDate.getDay();
          return (day === 5 || day === 6 || day === 0) && eventDate >= today && eventDate <= endOfWeek;
        }
        if (dateRange === "this_month") {
          return eventDate >= today && eventDate <= endOfMonth;
        }
        return true;
      });
    }

    // Sort by Trending (quantity_sold DESC)
    return result.sort((a, b) => (b.quantity_sold || 0) - (a.quantity_sold || 0));
  }, [events, category, city, dateRange]);

  const displayedEvents = filteredEvents.slice(0, pageSize);
  const hasMore = filteredEvents.length > pageSize;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Discover Events — Tixora</title>
        <meta name="description" content="Find the best concerts, conferences, and shows near you." />
      </Helmet>

      {/* Hero Section */}
      <section className="bg-primary/5 border-b border-border py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-foreground mb-4">
            Discover Events <span className="text-primary">Near You</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Find concerts, shows, conferences and more. Your next premium experience starts here.
          </p>
        </div>
      </section>

      {/* Sticky Filter Bar */}
      <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-xl border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Search Input */}
            <div className="relative w-full lg:flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by city or venue..."
                className="pl-10 h-11 bg-muted/30 border-none rounded-xl"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
              />
            </div>

            {/* Category Dropdown */}
            <div className="w-full lg:w-48">
              <Select value={category} onValueChange={(v) => setFilter("category", v)}>
                <SelectTrigger className="h-11 bg-muted/30 border-none rounded-xl">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-primary" />
                    <SelectValue placeholder="All Categories" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {EVENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 w-full lg:w-auto scrollbar-hide">
              {(["all", "today", "this_week", "this_weekend", "this_month"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setFilter("date", range)}
                  className={cn(
                    "px-4 h-11 rounded-xl text-sm font-bold whitespace-nowrap transition-all",
                    dateRange === range
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {range === "all" ? "All Dates" : range.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <main className="container mx-auto px-4 py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-20 bg-red-50 rounded-3xl border border-red-100">
            <p className="text-red-600 font-bold">Failed to load events. Please refresh the page.</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-24 bg-muted/20 rounded-3xl border border-dashed border-border">
            <div className="text-6xl mb-6">🔍</div>
            <h3 className="text-2xl font-bold mb-2">No events found</h3>
            <p className="text-muted-foreground">Try adjusting your filters or search terms.</p>
            <Button 
              variant="outline" 
              className="mt-6 border-primary text-primary"
              onClick={() => {
                setCityInput("");
                setSearchParams({}, { replace: true });
              }}
            >
              Clear all filters
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-primary" />
                Trending Events
              </h2>
              <p className="text-sm text-muted-foreground font-medium">
                Showing {filteredEvents.length} upcoming events
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {displayedEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>

            {hasMore && (
              <div className="mt-16 text-center">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="h-14 px-10 rounded-2xl border-2 border-primary text-primary font-bold hover:bg-primary hover:text-white transition-all"
                  onClick={() => setPageSize(prev => prev + 12)}
                >
                  Load More Events
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

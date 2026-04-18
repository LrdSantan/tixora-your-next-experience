import { useSearchParams } from "react-router-dom";
import { useEventSearch } from "@/hooks/use-events";
import EventCard from "@/components/EventCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Search as SearchIcon } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { EventCardSkeleton } from "@/components/EventCardSkeleton";



const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  
  const { data: results = [], isLoading } = useEventSearch(query);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Search Events | Tixora</title>
        <meta name="description" content="Discover and book tickets for the best events in Nigeria. Concerts, sports, food festivals and more on Tixora." />
        <meta property="og:title" content="Tixora — Book Events in Nigeria" />
        <meta property="og:description" content="Discover and book tickets for the best events in Nigeria." />
        <meta property="og:image" content="https://tixoraafrica.com.ng/og-default.png" />
        <meta property="og:url" content="https://tixoraafrica.com.ng" />
      </Helmet>
      <section className="container mx-auto px-4 py-8">
        <div className="mb-8 border-b border-border pb-6">
          <h1 className="text-3xl font-bold text-foreground">
            {query.trim() ? `Results for "${query}"` : "Search Events"}
          </h1>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {results.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center max-w-lg mx-auto">
            <SearchIcon className="w-12 h-12 text-primary mx-auto mb-4 opacity-80" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No events found for '{query}'
            </h3>
            <p className="text-sm text-muted-foreground">
              Try checking your spelling, use more general terms, or clear your search to see what's happening.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};

export default SearchPage;

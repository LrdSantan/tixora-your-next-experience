import { Search, ArrowRight, Music, Trophy, Theater, Laugh, PartyPopper } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import EventCard from "@/components/EventCard";
import { EVENTS } from "@/lib/mock-data";
import { useRef } from "react";

const CATEGORIES = [
  { name: "Concerts", icon: Music },
  { name: "Sports", icon: Trophy },
  { name: "Theatre", icon: Theater },
  { name: "Comedy", icon: Laugh },
  { name: "Festivals", icon: PartyPopper },
];

const HomePage = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      {/* Hero */}
      <section className="bg-hero text-primary-foreground">
        <div className="container mx-auto px-4 py-20 md:py-28 text-center space-y-6">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight animate-fade-in-up">
            Your Next Experience<br />Starts Here
          </h1>
          <p className="text-base md:text-lg text-primary-foreground/70 max-w-xl mx-auto" style={{ animationDelay: "0.1s", animation: "fade-in-up 0.6s ease-out 0.1s forwards", opacity: 0 }}>
            Discover and book the best concerts, sports, comedy shows, and festivals across Nigeria.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 max-w-xl mx-auto" style={{ animationDelay: "0.2s", animation: "fade-in-up 0.6s ease-out 0.2s forwards", opacity: 0 }}>
            <div className="flex items-center bg-background rounded-full px-4 py-3 flex-1 w-full">
              <Search className="w-4 h-4 text-muted-foreground mr-2" />
              <input type="text" placeholder="Search events, cities..." className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted-foreground" />
            </div>
            <Button className="bg-secondary text-secondary-foreground font-semibold h-12 px-6 rounded-full whitespace-nowrap">
              Find Events <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-foreground mb-6">Browse by Category</h2>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map(({ name, icon: Icon }) => (
            <button key={name} className="flex items-center gap-2 px-5 py-3 rounded-full bg-background border border-border hover:bg-accent hover:border-primary/30 transition-all group">
              <Icon className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Events - horizontal scroll */}
      <section className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Featured Events</h2>
          <Link to="/" className="text-sm text-primary font-medium hover:underline">View All</Link>
        </div>
        <div ref={scrollRef} className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {EVENTS.slice(0, 4).map((event) => (
            <div key={event.id} className="min-w-[280px] max-w-[320px] snap-start flex-shrink-0">
              <EventCard event={event} />
            </div>
          ))}
        </div>
      </section>

      {/* Upcoming Events Grid */}
      <section className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-foreground mb-6">Upcoming Events</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {EVENTS.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;

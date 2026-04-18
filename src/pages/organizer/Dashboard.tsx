import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { 
  BarChart3, 
  TrendingUp, 
  Ticket, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  LayoutDashboard, 
  AlertCircle,
  Search,
  Users
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getSupabaseClient } from "@/lib/supabase";
import { formatDate, formatPrice } from "@/lib/mock-data";
import { formatEventDateDisplay } from "@/lib/date-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tier = {
  id: string;
  name: string;
  price: number;
  total_quantity: number;
  remaining_quantity: number;
  sold_count: number;
  revenue: number;
};

type EventAnalytics = {
  id: string;
  title: string;
  date: string;
  status: string;
  is_multi_day: boolean;
  event_days: string[];
  total_sold: number;
  total_revenue: number;
  tiers: Tier[];
  top_tier: Tier | null;
};

export default function OrganizerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const supabase = getSupabaseClient();

  const [analytics, setAnalytics] = useState<EventAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchAnalytics = async () => {
    if (!user || !supabase) return;
    setIsLoading(true);

    try {
      // Fetch events with tiers and tickets
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select(`
          id, title, date, status, organizer_id, is_multi_day, event_days,
          ticket_tiers ( id, name, price, total_quantity, remaining_quantity ),
          tickets ( id, tier_id, amount_paid, quantity )
        `)
        .eq("organizer_id", user.id)
        .order("date", { ascending: false });

      if (eventsError) throw eventsError;

      const processed: EventAnalytics[] = (eventsData || []).map(event => {
        const tiers = (event.ticket_tiers || []).map(tier => {
          const tierTickets = (event.tickets || []).filter(t => t.tier_id === tier.id);
          const sold_count = tierTickets.reduce((sum, t) => sum + t.quantity, 0);
          const revenue = tierTickets.reduce((sum, t) => sum + (t.amount_paid / 100), 0);
          return { ...tier, sold_count, revenue };
        });

        const total_sold = tiers.reduce((sum, t) => sum + t.sold_count, 0);
        const total_revenue = tiers.reduce((sum, t) => sum + t.revenue, 0);
        
        // Find top selling tier
        const top_tier = tiers.length > 0 
          ? [...tiers].sort((a, b) => b.sold_count - a.sold_count)[0] 
          : null;

        return {
          id: event.id,
          title: event.title,
          date: event.date,
          status: event.status,
          is_multi_day: event.is_multi_day || false,
          event_days: event.event_days || [],
          total_sold,
          total_revenue,
          tiers,
          top_tier
        };
      });

      setAnalytics(processed);
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      toast.error("Failed to load dashboard analytics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?redirect=/organizer/dashboard");
    else if (user) fetchAnalytics();
  }, [user, authLoading]);

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  // Derived Summary Stats
  const totalRevenue = analytics.reduce((sum, e) => sum + e.total_revenue, 0);
  const totalSold = analytics.reduce((sum, e) => sum + e.total_sold, 0);
  const totalEvents = analytics.length;
  const activeEvents = analytics.filter(e => e.status === 'active' && new Date(e.date) >= new Date()).length;

  const filteredEvents = analytics.filter(e => 
    e.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-[#1a7a4a]" />
            Organizer Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Real-time overview of your event performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search events..." 
              className="pl-9 h-11 rounded-xl bg-card border-border"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button asChild className="bg-[#1a7a4a] hover:bg-[#1a7a4a]/90 h-11 rounded-xl px-5 gap-2">
            <Link to="/create-event">
              <Calendar className="w-4 h-4" />
              New Event
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard 
          title="Total Revenue" 
          value={formatPrice(totalRevenue)} 
          icon={<TrendingUp className="w-5 h-5" />}
          description="Gross earnings across all events"
        />
        <StatCard 
          title="Tickets Sold" 
          value={totalSold.toLocaleString()} 
          icon={<Ticket className="w-5 h-5" />}
          description="Total attendees confirmed"
        />
        <StatCard 
          title="Total Events" 
          value={totalEvents.toString()} 
          icon={<BarChart3 className="w-5 h-5" />}
          description="Lifetime events created"
        />
        <StatCard 
          title="Active Events" 
          value={activeEvents.toString()} 
          icon={<Calendar className="w-5 h-5" />}
          description="Live & upcoming on market"
          highlight
        />
      </div>

      {/* Events Table Container */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border bg-muted/30">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-[#1a7a4a]" />
            Event Performance
          </h2>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-16 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-medium text-foreground">No events found</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              You haven't created any events yet or none match your search criteria.
            </p>
            <Button className="mt-6 bg-[#1a7a4a] hover:bg-[#1a7a4a]/90" onClick={() => navigate("/create-event")}>
              Create First Event
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold text-center w-12"></th>
                  <th className="px-6 py-4 font-semibold">Event Details</th>
                  <th className="px-6 py-4 font-semibold text-center">Date</th>
                  <th className="px-6 py-4 font-semibold min-w-[150px]">Sales Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Revenue</th>
                  <th className="px-6 py-4 font-semibold text-center">Top Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEvents.map((event) => {
                  const isExpanded = expandedRows.has(event.id);
                  const totalCapacity = event.tiers.reduce((sum, t) => sum + t.total_quantity, 0);
                  const soldPercentage = totalCapacity > 0 ? (event.total_sold / totalCapacity) * 100 : 0;

                  return (
                    <React.Fragment key={event.id}>
                      <tr 
                        onClick={() => toggleRow(event.id)}
                        className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-5 text-center">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
                            isExpanded ? "bg-[#1a7a4a] text-white" : "bg-muted text-muted-foreground group-hover:bg-muted/50"
                          )}>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="font-bold text-foreground line-clamp-1">{event.title}</div>
                          <Badge variant="outline" className={cn(
                            "mt-1 text-[10px] h-4.5 uppercase font-bold",
                            event.status === 'active' ? "border-green-200 bg-green-50 text-green-700" : "bg-neutral-100"
                          )}>
                            {event.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-5 text-center text-sm text-muted-foreground whitespace-nowrap">
                          {formatEventDateDisplay(event.date, event.is_multi_day, event.event_days)}
                        </td>
                        <td className="px-6 py-5">
                          <div className="max-w-[140px]">
                            <div className="flex justify-between text-[11px] mb-1 font-bold">
                              <span>{event.total_sold.toLocaleString()} sold</span>
                              <span className="text-muted-foreground">{Math.round(soldPercentage)}%</span>
                            </div>
                            <Progress value={soldPercentage} className="h-1.5" />
                          </div>
                        </td>
                        <td className="px-6 py-5 font-bold text-foreground text-right tabular-nums">
                          {formatPrice(event.total_revenue)}
                        </td>
                        <td className="px-6 py-5 text-center">
                          {event.top_tier ? (
                            <Badge className="bg-[#1a7a4a]/10 text-[#1a7a4a] border-none font-bold text-[10px] px-2 py-0.5 whitespace-nowrap">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              {event.top_tier.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-muted/5 border-b border-border shadow-inner">
                          <td colSpan={6} className="px-6 py-10">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                              {event.tiers.map((tier) => {
                                const isTop = event.top_tier?.id === tier.id;
                                const tierShare = event.total_sold > 0 ? (tier.sold_count / event.total_sold) * 100 : 0;
                                const tierFill = tier.total_quantity > 0 ? (tier.sold_count / tier.total_quantity) * 100 : 0;
                                
                                return (
                                  <div 
                                    key={tier.id} 
                                    className={cn(
                                      "bg-card rounded-2xl border p-5 transition-all duration-300 relative group/tier",
                                      isTop ? "border-[#1a7a4a] shadow-sm ring-1 ring-[#1a7a4a]/10" : "border-border hover:border-border/80"
                                    )}
                                  >
                                    <div className="flex justify-between items-start mb-4">
                                      <div>
                                        <div className="font-bold flex items-center gap-2 text-base">
                                          {tier.name}
                                          {isTop && (
                                            <Badge className="bg-[#1a7a4a] text-white text-[9px] h-4 uppercase font-bold tracking-wider px-1.5 border-none shadow-sm">
                                              Top
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="text-xs text-muted-foreground font-medium mt-0.5">{formatPrice(tier.price)} per ticket</div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-sm font-bold text-foreground">{tier.sold_count} SOLD</div>
                                        <div className="text-[13px] text-[#1a7a4a] font-bold mt-0.5 tabular-nums">{formatPrice(tier.revenue)}</div>
                                      </div>
                                    </div>

                                    <div className="space-y-4">
                                      <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                                          <span>Event Sales Share</span>
                                          <span className={cn(isTop ? "text-[#1a7a4a]" : "")}>{Math.round(tierShare)}%</span>
                                        </div>
                                        <Progress 
                                          value={tierShare} 
                                          className="h-1.5 bg-muted" 
                                          indicatorClassName={isTop ? "bg-[#1a7a4a]" : "bg-primary"}
                                        />
                                      </div>

                                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground">Capacity</div>
                                        <div className="text-[11px] font-bold text-foreground">
                                          {tier.sold_count} / {tier.total_quantity}
                                          <span className="text-muted-foreground text-[9px] ml-1 font-medium">({Math.round(tierFill)}%)</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  description, 
  highlight = false 
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  description: string;
  highlight?: boolean;
}) {
  return (
    <Card className={cn(
      "border-none shadow-sm transition-all duration-300 hover:shadow-md overflow-hidden relative group",
      highlight ? "bg-card ring-1 ring-[#1a7a4a]/30" : "bg-card"
    )}>
      {/* Background Accent */}
      <div className={cn(
        "absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500",
        highlight ? "bg-[#1a7a4a]" : "bg-primary"
      )} />
      
      <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0 relative z-10">
        <CardTitle className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
        <div className={cn(
          "p-2.5 rounded-xl transition-all duration-300 group-hover:scale-110",
          highlight ? "bg-[#1a7a4a]/10 text-[#1a7a4a]" : "bg-primary/10 text-primary"
        )}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="relative z-10">
        <div className={cn(
          "text-3xl font-bold tracking-tight tabular-nums",
          highlight ? "text-[#1a7a4a]" : "text-foreground"
        )}>
          {value}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1 font-medium italic opacity-80">{description}</p>
      </CardContent>
    </Card>
  );
}

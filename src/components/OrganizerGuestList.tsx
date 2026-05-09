import { useState, useEffect } from "react";
import { 
  Users, 
  Search, 
  Download, 
  Loader2, 
  ChevronRight, 
  Mail, 
  Phone,
  Ticket as TicketIcon
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSupabaseClient } from "@/lib/supabase";
import { toast } from "sonner";
import { formatPrice } from "@/lib/mock-data";

interface Guest {
  id: string;
  ticket_code: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  status: string;
  created_at: string;
  tier_name: string;
  answers: {
    question_text: string;
    answer: string;
  }[];
}

export function OrganizerGuestList({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const supabase = getSupabaseClient();

  const fetchGuests = async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      // 1. Fetch tickets for this event
      const { data: tickets, error: ticketsError } = await supabase
        .from("tickets")
        .select(`
          id,
          ticket_code,
          guest_name,
          guest_email,
          guest_phone,
          status,
          created_at,
          ticket_tiers ( name )
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (ticketsError) throw ticketsError;

      // 2. Fetch all answers for these tickets
      const ticketIds = (tickets || []).map(t => t.id);
      let answersMap: Record<string, any[]> = {};
      
      if (ticketIds.length > 0) {
        const { data: answers, error: answersError } = await supabase
          .from("registration_answers")
          .select(`
            ticket_id,
            answer,
            registration_questions ( question_text )
          `)
          .in("ticket_id", ticketIds);

        if (answersError) throw answersError;

        (answers || []).forEach(a => {
          if (!answersMap[a.ticket_id]) answersMap[a.ticket_id] = [];
          answersMap[a.ticket_id].push({
            question_text: a.registration_questions?.question_text || "Unknown Question",
            answer: a.answer
          });
        });
      }

      const processed: Guest[] = (tickets || []).map(t => ({
        id: t.id,
        ticket_code: t.ticket_code,
        guest_name: t.guest_name || "Unknown",
        guest_email: t.guest_email || "No Email",
        guest_phone: t.guest_phone || "No Phone",
        status: t.status,
        created_at: t.created_at,
        tier_name: (t.ticket_tiers as any)?.name || "Unknown Tier",
        answers: answersMap[t.id] || []
      }));

      setGuests(processed);
    } catch (err: any) {
      toast.error(err.message || "Failed to load guests");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchGuests();
  }, [open]);

  const filteredGuests = guests.filter(g => 
    g.guest_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.guest_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.ticket_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExport = () => {
    if (guests.length === 0) return;
    
    const headers = ["Ticket Code", "Guest Name", "Email", "Phone", "Tier", "Status", "Joined At"];
    // Add unique question texts as headers
    const allQuestions = Array.from(new Set(guests.flatMap(g => g.answers.map(a => a.question_text))));
    const fullHeaders = [...headers, ...allQuestions];

    const rows = guests.map(g => {
      const baseData = [
        g.ticket_code,
        g.guest_name,
        g.guest_email,
        g.guest_phone,
        g.tier_name,
        g.status,
        new Date(g.created_at).toLocaleDateString()
      ];
      
      const answerData = allQuestions.map(q => {
        const found = g.answers.find(a => a.question_text === q);
        return found ? found.answer : "";
      });
      
      return [...baseData, ...answerData].map(v => `"${v}"`).join(",");
    });

    const csvContent = [fullHeaders.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `guests-${eventTitle.toLowerCase().replace(/\s+/g, "-")}.csv`);
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3 border-border hover:bg-muted" title="View Guest List">
          <Users className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold">Guest List</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{eventTitle}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2" 
              onClick={handleExport}
              disabled={guests.length === 0}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
          
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, email, or code..." 
              className="pl-10 h-10 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 pb-6">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredGuests.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <Users className="w-12 h-12 mb-4" />
              <p>{searchQuery ? "No guests match your search" : "No guests have registered yet"}</p>
            </div>
          ) : (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                {filteredGuests.map((guest) => (
                  <div key={guest.id} className="border rounded-xl p-4 bg-muted/20 hover:bg-muted/30 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{guest.guest_name}</span>
                          <Badge variant="outline" className="text-[10px] h-4.5 uppercase font-bold">
                            {guest.tier_name}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3" />
                            {guest.guest_email}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3" />
                            {guest.guest_phone}
                          </div>
                          <div className="flex items-center gap-1.5 font-mono">
                            <TicketIcon className="w-3 h-3" />
                            {guest.ticket_code}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">
                          {new Date(guest.created_at).toLocaleDateString()}
                        </div>
                        <Badge className={cn(
                          "uppercase font-bold text-[10px] px-2 py-0.5",
                          guest.status === 'confirmed' ? "bg-green-100 text-green-700 border-green-200" : "bg-neutral-100 text-neutral-600"
                        )}>
                          {guest.status}
                        </Badge>
                      </div>
                    </div>

                    {guest.answers.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Registration Answers</p>
                        <div className="space-y-2">
                          {guest.answers.map((a, i) => (
                            <div key={i} className="text-xs">
                              <span className="font-semibold text-foreground block">{a.question_text}</span>
                              <span className="text-muted-foreground">{a.answer}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

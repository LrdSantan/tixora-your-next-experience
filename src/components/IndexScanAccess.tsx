import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { QrCode, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export function IndexScanAccess() {
  const { user, loading } = useAuth();
  const supabase = getSupabaseClient();
  const navigate = useNavigate();
  
  const [events, setEvents] = useState<any[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [open, setOpen] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    if (loading || !user || !supabase) return;
    
    async function checkAccess() {
      // Admin
      if (user?.email === "yusufquadir50@gmail.com") {
        setHasAccess(true);
        return;
      }
      
      // Organizer
      const { data: orgEvents } = await supabase!
        .from("events")
        .select("id")
        .eq("organizer_id", user!.id)
        .limit(1);
        
      if (orgEvents && orgEvents.length > 0) {
        setHasAccess(true);
        return;
      }
      
      // Team Member
      const { data: teamAccess } = await supabase!
        .from("organizer_team_members")
        .select("organizer_id")
        .eq("member_id", user!.id)
        .eq("status", "accepted")
        .limit(1);
        
      if (teamAccess && teamAccess.length > 0) {
        setHasAccess(true);
        return;
      }
    }
    
    checkAccess();
  }, [user, loading, supabase]);

  async function loadEvents() {
    setLoadingEvents(true);
    setOpen(true);
    
    if (user?.email === "yusufquadir50@gmail.com") {
      const { data } = await supabase!.from("events").select("id, title, date").order("created_at", { ascending: false });
      setEvents(data || []);
    } else {
      // Organizer or Team Member
      const { data: teamAccess } = await supabase!
        .from("organizer_team_members")
        .select("organizer_id")
        .eq("member_id", user!.id)
        .eq("status", "accepted");
        
      const organizerIds = [user!.id];
      if (teamAccess) {
        organizerIds.push(...teamAccess.map(t => t.organizer_id));
      }
      
      const { data } = await supabase!
        .from("events")
        .select("id, title, date")
        .in("organizer_id", organizerIds)
        .order("created_at", { ascending: false });
        
      setEvents(data || []);
    }
    setLoadingEvents(false);
  }

  if (!hasAccess || loading) return null;

  return (
    <>
      <div 
        className="mt-6 flex justify-center"
        style={{ animationDelay: "0.3s", animation: "fade-in-up 0.6s ease-out 0.3s forwards", opacity: 0 }}
      >
        <Button 
          onClick={loadEvents} 
          className="h-12 px-8 bg-[#1A7A4A] text-white rounded-full font-bold shadow-lg hover:shadow-xl hover:bg-[#155a37] text-base gap-2 transition-all transform hover:-translate-y-0.5 flex items-center"
        >
          <QrCode className="w-5 h-5 flex-shrink-0" />
          Scan Tickets
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-5 border-b border-neutral-100 flex-shrink-0">
            <DialogTitle className="text-xl font-bold text-neutral-900">Select Event to Scan</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-neutral-50/50">
            {loadingEvents ? (
              <div className="space-y-3">
                 <Skeleton className="h-20 w-full rounded-2xl bg-white border border-neutral-100 shadow-sm" />
                 <Skeleton className="h-20 w-full rounded-2xl bg-white border border-neutral-100 shadow-sm" />
                 <Skeleton className="h-20 w-full rounded-2xl bg-white border border-neutral-100 shadow-sm" />
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                  <QrCode className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="text-neutral-900 font-bold mb-1">No active events</h3>
                <p className="text-sm text-neutral-500">You don't have any events to scan tickets for.</p>
              </div>
            ) : (
             events.map(event => (
               <button
                 key={event.id}
                 onClick={() => navigate(`/admin/events/${event.id}/scan`)}
                 className="w-full text-left p-4 rounded-2xl border border-neutral-200 bg-white hover:border-[#1A7A4A]/50 hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between group"
               >
                 <div>
                   <h4 className="font-bold text-neutral-900 group-hover:text-[#1A7A4A] transition-colors line-clamp-1">{event.title}</h4>
                   <p className="text-sm font-medium text-neutral-500 mt-0.5">
                     {new Date(event.date).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                   </p>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-neutral-50 group-hover:bg-[#1A7A4A]/10 flex flex-shrink-0 items-center justify-center transition-colors">
                   <ArrowRight className="w-5 h-5 text-neutral-400 group-hover:text-[#1A7A4A] transition-colors" />
                 </div>
               </button>
             ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

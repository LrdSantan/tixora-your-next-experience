import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, AlertTriangle, ShieldCheck, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SyncQueue } from "@/lib/sync-queue";

const ADMIN_EMAIL = "yusufquadir50@gmail.com";

type TicketData = {
  id: string;
  ticket_code: string;
  reference: string;
  amount_paid: number;
  is_used: boolean;
  used_at: string | null;
  created_at: string;
  qr_token: string | null;
  event_id: string | null;
  events: {
    title: string;
    date: string;
    time: string;
    venue: string;
    city: string;
    organizer_id: string | null;
    is_multi_day: boolean | null;
    event_days: string[] | null;
  } | null;
  ticket_tiers: { name: string } | null;
};

type PageState = "loading" | "not_found" | "valid" | "used" | "scanned_today" | "idle";

const playFeedbackSound = (type: "success" | "error") => {
  try {
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    const ctx = new AudioContextClass();
    
    if (type === "success") {
      // Double beep (Short E5 then longer A5)
      const playBeep = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
        gain.gain.linearRampToValueAtTime(0, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = ctx.currentTime;
      playBeep(660, now, 0.08); // E5
      playBeep(880, now + 0.12, 0.15); // A5
    } else {
      // Low buzz (Low sawtooth sliding down)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(100, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    console.warn("Audio feedback blocked or failed:", e);
  }
};

export default function VerifyTicketPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const navigate = useNavigate();
  const supabase = getSupabaseClient();
  const { user, loading: authLoading } = useAuth();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [marking, setMarking] = useState(false);
  const [isOrganizerOrTeam, setIsOrganizerOrTeam] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [isPendingSync, setIsPendingSync] = useState(false);
  const [flash, setFlash] = useState<{ color: string; active: boolean } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isJustMarked, setIsJustMarked] = useState(false);
  const scanCountRef = useRef(0);
  const [displayScanCount, setDisplayScanCount] = useState(0);

  const isAdmin = !authLoading && user?.email === ADMIN_EMAIL;
  const canMark = isAdmin || isOrganizerOrTeam;

  useEffect(() => {
    async function fetchTicket() {
      if (!qrToken) {
        setPageState("idle");
        setTicket(null);
        setIsJustMarked(false);
        setCountdown(null);
        return;
      }

      let cleanToken = qrToken.trim();
      if (cleanToken.includes('/verify/')) {
        cleanToken = cleanToken.split('/verify/').pop() || cleanToken;
      }

      if (!supabase) {
        setPageState("not_found");
        return;
      }

      // ── Offline Handling ──
      if (!navigator.onLine) {
        setIsOfflineMode(true);
        let foundTicket: any = null;
        
        // Search all tixora_cache_ keys
        const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith('tixora_cache_') && !k.endsWith('_at'));
        for (const key of cacheKeys) {
          try {
            const cachedArray = JSON.parse(localStorage.getItem(key) || '[]');
            const match = cachedArray.find((t: any) => t.qr_token === cleanToken);
            if (match) {
              foundTicket = match;
              break;
            }
          } catch (e) {
            console.error("Cache parse error", e);
          }
        }

        if (foundTicket) {
          // Found in cache! Use the rich cached data
          console.log("[Verify] Found ticket in local cache", foundTicket);
          setTicket(foundTicket);
          setPageState("valid");

          // Check if this ticket is in the sync queue
          const queue = SyncQueue.get();
          if (queue.find(s => s.id === foundTicket.id)) {
            setIsPendingSync(true);
            setPageState("used");
          }
        } else {
          setOfflineError("You're offline and this ticket wasn't cached.");
          setPageState("not_found");
        }
        return;
      }

      setIsOfflineMode(false);
      const { data, error } = await supabase
        .from("tickets")
        .select(`
          id,
          ticket_code,
          reference,
          amount_paid,
          is_used,
          used_at,
          created_at,
          qr_token,
          event_id,
          events ( title, date, time, venue, city, organizer_id, is_multi_day, event_days ),
          ticket_tiers ( name )
        `)
        .eq("qr_token", cleanToken)
        .single();

      if (error || !data) {
        setPageState("not_found");
        return;
      }

      setTicket(data as TicketData);
      
      // If we're online but the ticket is in our local sync queue, 
      // it means it hasn't synced yet but we want to show it as "Used" locally.
      const queue = SyncQueue.get();
      const isPending = queue.find(s => s.id === data.id);
      
      if (isPending) {
        setIsPendingSync(true);
        setPageState("used");
      } else if (data.events?.is_multi_day) {
        // Multi-day event: check if already scanned today
        const today = new Date().toISOString().split('T')[0];
        const { data: scanData } = await supabase
          .from("ticket_scans")
          .select("id")
          .eq("ticket_id", data.id)
          .eq("scan_date", today)
          .maybeSingle();
        
        if (scanData) {
          setPageState("scanned_today");
        } else {
          setPageState("valid");
        }
      } else {
        setIsPendingSync(false);
        setPageState(data.is_used ? "used" : "valid");
      }
    }

    fetchTicket();
  }, [qrToken, supabase]);

  // Prefetch other tickets for the same event for offline readiness
  useEffect(() => {
    async function prefetchEventTickets() {
      if (!supabase || !ticket?.event_id || !navigator.onLine) return;

      try {
        const { data, error } = await supabase
          .from("tickets")
          .select(`
            id, 
            qr_token, 
            ticket_code, 
            reference, 
            amount_paid, 
            created_at, 
            event_id,
            events ( title, date, time, venue, city, organizer_id ),
            ticket_tiers ( name )
          `)
          .eq("event_id", ticket.event_id)
          .eq("is_used", false);

        if (!error && data) {
          localStorage.setItem(`tixora_cache_${ticket.event_id}`, JSON.stringify(data));
          localStorage.setItem(`tixora_cache_${ticket.event_id}_at`, new Date().toISOString());
          console.log(`[Verify] Cached ${data.length} tickets for event ${ticket.event_id}`);
        }
      } catch (err) {
        console.error("Failed to prefetch tickets for offline use", err);
      }
    }

    if (ticket?.event_id) {
      prefetchEventTickets();
    }
  }, [ticket?.event_id, supabase]);

  // Check if the current user is organizer or accepted team member
  useEffect(() => {
    async function checkOrganizerAccess() {
      if (authLoading) return;
      setAuthChecking(true);
      try {
        if (!supabase || !user || !ticket) {
          setIsOrganizerOrTeam(false);
          return;
        }
        const organizerId = ticket.events?.organizer_id;
        if (!organizerId) {
          setIsOrganizerOrTeam(false);
          return;
        }
        // Check if user is the organizer
        if (user.id === organizerId) {
          setIsOrganizerOrTeam(true);
          return;
        }
        // Check if user is an accepted team member of the organizer
        const { data: membership } = await supabase
          .from("organizer_team_members")
          .select("id")
          .eq("organizer_id", organizerId)
          .eq("member_id", user.id)
          .eq("status", "accepted")
          .maybeSingle();
        setIsOrganizerOrTeam(Boolean(membership));
      } finally {
        setAuthChecking(false);
      }
    }
    checkOrganizerAccess();
  }, [ticket, user, authLoading, supabase]);

  // Handle auto-sync
  useEffect(() => {
    const handleOnline = () => {
      console.log("[Verify] Back online, triggering sync...");
      SyncQueue.processQueue((syncedCode) => {
        toast.info(`Synced ticket ${syncedCode}`);
        // If the current ticket was the one synced, update the UI
        if (ticket && ticket.ticket_code === syncedCode) {
          setIsPendingSync(false);
          setPageState("used");
        }
      });
    };

    window.addEventListener("online", handleOnline);
    
    // Also try syncing on mount if online
    if (navigator.onLine) {
      SyncQueue.processQueue();
    }

    return () => window.removeEventListener("online", handleOnline);
  }, [ticket]);

  // Audio and visual feedback when result is determined
  useEffect(() => {
    if (pageState === "loading") return;

    let color = "";
    if (pageState === "valid") {
      playFeedbackSound("success");
      color = "rgba(34, 197, 94, 0.4)"; // Bright green
    } else if (pageState === "used" || pageState === "not_found") {
      playFeedbackSound("error");
      color = pageState === "used" ? "rgba(249, 115, 22, 0.4)" : "rgba(239, 68, 68, 0.4)"; // Orange or Red
    }

    if (color) {
      setFlash({ color, active: true });
      // Trigger the fade out almost immediately
      const timer = setTimeout(() => {
        setFlash(prev => prev ? { ...prev, active: false } : null);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [pageState]);

  // Handle countdown and auto-reset
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown hit 0, reset everything
      const resetTimer = setTimeout(() => {
        setTicket(null);
        setPageState("idle");
        setIsJustMarked(false);
        setCountdown(null);
        navigate("/verify", { replace: true });
      }, 500); // Slight delay for final 1 -> 0 feel
      return () => clearTimeout(resetTimer);
    }
  }, [countdown, navigate]);

  const handleMarkUsed = async () => {
    if (!supabase || !ticket) return;
    setMarking(true);

    const isMultiDay = ticket.events?.is_multi_day;

    try {
      // ── Offline Mode Handler ──
      if (!navigator.onLine) {
        SyncQueue.push({
          id: ticket.id,
          ticket_code: ticket.ticket_code,
          scanned_at: new Date().toISOString()
        });
        
        setIsPendingSync(true);
        setPageState("used");
        setIsJustMarked(true);
        setCountdown(3);
        scanCountRef.current += 1;
        setDisplayScanCount(scanCountRef.current);
        toast.success("Ticket verified offline. It will sync when connection returns.");
        setMarking(false);
        return;
      }

      if (isMultiDay) {
        // ── Multi-Day: Insert a scan record for today ──
        const today = new Date().toISOString().split('T')[0];
        const { error: scanError } = await supabase
          .from("ticket_scans")
          .insert({
            ticket_id: ticket.id,
            event_id: ticket.event_id,
            scan_date: today,
            scanner_id: user?.id ?? null,
          });

        if (scanError) {
          // Unique constraint violation means already scanned today
          if (scanError.code === '23505') {
            setPageState("scanned_today");
            toast.warning("This ticket was already scanned today.");
          } else {
            throw scanError;
          }
          return;
        }

        setPageState("used");
        setIsJustMarked(true);
        setCountdown(3);
        scanCountRef.current += 1;
        setDisplayScanCount(scanCountRef.current);
        toast.success("Entry recorded for today!");
      } else {
        // ── Single-Day: Mark ticket as permanently used ──
        const { data, error } = await supabase.rpc("mark_ticket_used", {
          p_ticket_code: ticket.ticket_code,
        });

        if (error) throw error;

        // Call the edge function to rotate the QR token
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        await fetch("https://hxvgoavigoopcgbmvltf.supabase.co/functions/v1/rotate-qr-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ ticketId: ticket.id }),
        });

        setTicket((prev) => prev ? { ...prev, is_used: true, used_at: new Date().toISOString() } : prev);
        setPageState("used");
        setIsJustMarked(true);
        setCountdown(3);
        scanCountRef.current += 1;
        setDisplayScanCount(scanCountRef.current);
        toast.success("Ticket marked as used successfully");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to mark ticket as used");
    } finally {
      setMarking(false);
    }
  };

  // ── Idle / Waiting for Scan ──
  if (pageState === "idle") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 overflow-hidden relative">
        <ScanCounter count={displayScanCount} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />
        
        <div className="w-full max-w-md text-center space-y-8 relative z-10">
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center mb-6 shadow-sm border border-primary/20 rotate-[-10deg]">
              <Ticket className="w-12 h-12 text-primary rotate-[-20deg]" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-neutral-900 mb-2">TIXORA</h1>
            <p className="text-neutral-500 font-medium">Ticket Guard — Security Mode</p>
          </div>

          <div className="bg-neutral-50 border border-neutral-200 rounded-3xl p-8 shadow-sm">
            <div className="w-16 h-16 bg-white border border-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <div className="w-8 h-8 rounded-lg border-4 border-primary border-t-transparent animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 mb-2">Waiting for scan</h2>
            <p className="text-sm text-neutral-500 max-w-[200px] mx-auto leading-relaxed">
              Place a ticket QR code in front of the camera to verify.
            </p>
          </div>

          <div className="flex justify-center gap-6">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" />
              Secure
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 uppercase tracking-widest">
              <CheckCircle className="w-4 h-4" />
              Verified
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (pageState === "loading" || authLoading || authChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 relative">
        <ScanCounter count={displayScanCount} />
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // ── Not Found ──
  if (pageState === "not_found") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 relative">
        <ScanCounter count={displayScanCount} />
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-6 sm:p-8 text-center overflow-hidden">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900 mb-2">Invalid Ticket</h1>
          <p className="text-neutral-500 mb-6">
            {offlineError || <>The ticket could not be verified in our system. This ticket may be invalid or the code may be incorrect.</>}
          </p>
          <div className="rounded-xl bg-red-50 border border-red-200 p-4">
            <p className="text-sm font-semibold text-red-700">⛔ Do not grant entry with this ticket</p>
          </div>
          <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">← Back to Tixora</Link>
        </div>
      </div>
    );
  }

  const ev = ticket?.events;
  const tierName = ticket?.ticket_tiers?.name ?? "Ticket";
  const amountPaid = ticket ? `₦${(ticket.amount_paid / 100).toLocaleString()}` : "";

  // ── Already Scanned Today (multi-day) ──
  if (pageState === "scanned_today") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8 sm:py-12 w-full overflow-x-hidden relative">
        <ScanCounter count={displayScanCount} />
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-6 sm:p-8 overflow-hidden">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-neutral-900">Already Scanned Today</h1>
            <p className="mt-2 text-sm text-neutral-500">
              This ticket was already used for entry on{" "}
              {new Date().toLocaleDateString("en-NG", { dateStyle: "long" })}.
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-6">
            <p className="text-sm font-semibold text-amber-700">⚠️ Do not grant entry again today. This is a multi-day ticket — it is valid on other event days.</p>
          </div>

          <TicketDetailCard ticket={ticket!} ev={ev} tierName={tierName} amountPaid={amountPaid} />

          <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">← Back to Tixora</Link>
        </div>
      </div>
    );
  }

  // ── Used ──
  if (pageState === "used") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8 sm:py-12 w-full overflow-x-hidden relative">
        <ScanCounter count={displayScanCount} />
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-6 sm:p-8 overflow-hidden">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-neutral-900">Ticket Already Used</h1>
            {ticket?.used_at && (
              <p className="mt-2 text-sm text-neutral-500">
                Used on {new Date(ticket.used_at).toLocaleString("en-NG", { dateStyle: "full", timeStyle: "short" })}
              </p>
            )}
          </div>

          <div className={cn(
            "rounded-xl border p-4 mb-6",
            isPendingSync ? "bg-blue-50 border-blue-200" : 
            isJustMarked ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"
          )}>
            <p className={cn(
              "text-sm font-semibold",
              isPendingSync ? "text-blue-700" : 
              isJustMarked ? "text-green-700" : "text-orange-700"
            )}>
              {isPendingSync 
                ? "⚡ Valid (Offline Scan). This will sync once you're online." 
                : isJustMarked
                ? `✅ Verification complete! Ready in ${countdown}...`
                : "⚠️ This ticket has already been scanned. Do not grant re-entry."}
            </p>
          </div>

          <TicketDetailCard ticket={ticket!} ev={ev} tierName={tierName} amountPaid={amountPaid} />

          <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">← Back to Tixora</Link>
        </div>
      </div>
    );
  }

  // ── Valid / Render Body ──
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8 sm:py-12 w-full overflow-x-hidden relative">
      <ScanCounter count={displayScanCount} />
      {isOfflineMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-100 border-b border-amber-200 py-2.5 px-4 text-center">
          <p className="text-sm font-bold text-amber-800 flex items-center justify-center gap-2">
            <span>⚡ Offline Mode</span>
            <span className="font-normal opacity-80 decoration-dotted underline">Local cache being used</span>
          </p>
        </div>
      )}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-6 sm:p-8 overflow-hidden">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900">Valid Ticket</h1>
          <p className="mt-1 text-sm text-neutral-500">This ticket is authentic and has not been used.</p>
        </div>

        <div className="rounded-xl bg-green-50 border border-green-200 p-4 mb-6">
          <p className="text-sm font-semibold text-green-700">✅ Safe to grant entry</p>
        </div>

        <TicketDetailCard ticket={ticket!} ev={ev} tierName={tierName} amountPaid={amountPaid} />

        {/* Organizer / Team: Mark as Used */}
        {canMark ? (
          <Button
            onClick={handleMarkUsed}
            disabled={marking}
            className="w-full mt-6 h-12 text-base font-bold text-white rounded-xl bg-[#1A7A4A] hover:bg-[#155a37] flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-5 h-5" />
            {marking ? "Marking as used…" : "Mark as Used"}
          </Button>
        ) : (
          <div className="mt-6 rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-center">
            {user ? (
              <p className="text-sm text-neutral-500">You are not authorized to verify this ticket.</p>
            ) : (
              <>
                <p className="text-sm text-neutral-500 mb-3">Organizer? Log in to mark this ticket as used.</p>
                <Link to={`/login?redirect=/verify/${qrToken}`}>
                  <Button variant="outline" size="sm" className="border-primary text-primary">
                    Log in
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}

        <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">← Back to Tixora</Link>
      </div>

      {/* Flash Overlay */}
      {flash && (
        <div 
          className="fixed inset-0 z-[9999] pointer-events-none transition-opacity duration-[600ms] ease-out"
          style={{ 
            backgroundColor: flash.color,
            opacity: flash.active ? 1 : 0 
          }}
        />
      )}
    </div>
  );
}

function ScanCounter({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="fixed top-6 right-6 z-50">
      <div className="bg-[#1A7A4A] text-white px-4 py-2 rounded-full shadow-lg border border-white/20 flex items-center gap-2 animate-in fade-in zoom-in duration-300">
        <span className="text-sm font-bold truncate">✓ {count} scanned</span>
      </div>
    </div>
  );
}

// ── Shared detail card ──
function TicketDetailCard({
  ticket,
  ev,
  tierName,
  amountPaid,
}: {
  ticket: TicketData;
  ev: TicketData["events"];
  tierName: string;
  amountPaid: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 space-y-3 text-sm">
      <div className="flex items-center gap-2 mb-1">
        <Ticket className="w-5 h-5 text-[#1A7A4A] rotate-[-20deg] shrink-0" />
        <span className="font-extrabold text-base text-neutral-900">{ev?.title ?? "Event"}</span>
      </div>
      <DetailRow label="Ticket Code" value={<span className="font-mono font-bold text-[#1A7A4A]">{ticket.ticket_code}</span>} />
      <DetailRow label="Tier" value={tierName} />
      <DetailRow label="Amount Paid" value={amountPaid} />
      {ev && (
        <>
          <DetailRow label="Date" value={new Date(ev.date).toLocaleDateString("en-NG", { dateStyle: "long" })} />
          <DetailRow label="Time" value={ev.time} />
          <DetailRow label="Venue" value={`${ev.venue}, ${ev.city}`} />
        </>
      )}
      <DetailRow label="Purchased" value={new Date(ticket.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })} />
      <DetailRow label="Reference" value={<span className="font-mono text-xs">{ticket.reference}</span>} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3 w-full">
      <span className="text-neutral-500 shrink-0">{label}</span>
      <span className="font-semibold text-neutral-900 text-right break-all sm:break-words min-w-0">{value}</span>
    </div>
  );
}

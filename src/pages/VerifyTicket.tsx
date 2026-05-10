import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, XCircle, AlertTriangle, ShieldCheck, Ticket, Lock, Unlock, Clock, User, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SyncQueue } from "@/lib/sync-queue";
import { formatDistanceToNow } from "date-fns";

import { extractTicketToken } from "@/lib/scanner";

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
  guest_name: string | null;
  events: {
    title: string;
    date: string;
    time: string;
    venue: string;
    city: string;
    organizer_id: string | null;
    is_multi_day: boolean | null;
    event_days: string[] | null;
    scanner_mode?: "standard" | "express";
    scanner_mode_locked?: boolean;
  } | null;
  ticket_tiers: { name: string } | null;
};

type RecentScan = {
  id: string;
  guestName: string;
  tierName: string;
  status: "success" | "used" | "invalid";
  timestamp: Date;
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
  const [searchParams] = useSearchParams();
  const queryToken = searchParams.get("token");
  const eventId = searchParams.get("eventId") || searchParams.get("event_id") || searchParams.get("event");
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
  
  const [scannerMode, setScannerMode] = useState<"standard" | "express">("standard");
  const [scannerModeLocked, setScannerModeLocked] = useState(false);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [isRecentScansExpanded, setIsRecentScansExpanded] = useState(false);
  
  // ── Debug State (Temporary) ──
  const [debugRaw, setDebugRaw] = useState<string>("");
  const [debugToken, setDebugToken] = useState<string>("");

  const isAdmin = !authLoading && user?.email === ADMIN_EMAIL;
  const canMark = isAdmin || isOrganizerOrTeam;

  // ── Initial Scanner Mode Fetch ──
  useEffect(() => {
    if (!eventId || !supabase) return;
    async function fetchEventMode() {
      const { data, error } = await supabase
        .from("events")
        .select("scanner_mode, scanner_mode_locked")
        .eq("id", eventId)
        .maybeSingle();
      
      if (!error && data) {
        setScannerMode((data.scanner_mode?.toLowerCase() as "standard" | "express") || "standard");
        setScannerModeLocked(data.scanner_mode_locked || false);
      }
    }
    fetchEventMode();
  }, [eventId, supabase]);

  // ── Hardware Scanner Support ──
  useEffect(() => {
    let buffer = "";
    let timeout: ReturnType<typeof setTimeout>;
    const processScannedValue = (value: string) => {
      const token = extractTicketToken(value);

      setDebugRaw(value);
      setDebugToken(token);

      console.log(`[Verify] Hardware scanner raw: "${value}" -> extracted: "${token}"`);

      if (token) {
        console.log("[Verify] Hardware scanner detected token:", token);
        // Clear current state and navigate to the new token
        setPageState("loading");
        navigate(`/verify/${token}`, { replace: true });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" || 
        target.tagName === "TEXTAREA" || 
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Enter") {
        if (buffer) processScannedValue(buffer);
        buffer = "";
        return;
      }

      // Add character to buffer
      // Scanners send characters very quickly
      if (e.key.length === 1) {
        buffer += e.key;
      }

      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (buffer) processScannedValue(buffer);
        buffer = "";
      }, 100);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timeout);
    };
  }, [navigate]);

  useEffect(() => {
    async function fetchTicket() {
      const activeToken = queryToken || qrToken;

      if (!activeToken) {
        setPageState("idle");
        setTicket(null);
        setIsJustMarked(false);
        setCountdown(null);
        return;
      }

      const cleanToken = extractTicketToken(activeToken);

      console.log(`[Verify] Fetching ticket for token: "${cleanToken}" (raw query/param: "${activeToken}")`);

      setDebugRaw(activeToken);
      setDebugToken(cleanToken);

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
            const match = cachedArray.find((t: any) => 
              t.qr_token === cleanToken || t.ticket_code === cleanToken
            );
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
          guest_name,
          events ( title, date, time, venue, city, organizer_id, is_multi_day, event_days, scanner_mode, scanner_mode_locked ),
          ticket_tiers ( name )
        `)
        .or(`qr_token.eq.${cleanToken},ticket_code.eq.${cleanToken}`)
        .maybeSingle();

      if (error || !data) {
        setPageState("not_found");
        return;
      }

      setTicket(data as TicketData);
      
      // If we're online but the ticket is in our local sync queue, 
      // it means it hasn't synced yet but we want to show it as "Used" locally.
      const queue = SyncQueue.get();
      const isPending = queue.find(s => s.id === data.id);
      
      let nextState: PageState = "valid";
      if (isPending) {
        nextState = "used";
      } else if (data.events?.is_multi_day) {
        const today = new Date().toISOString().split('T')[0];
        const { data: scanData } = await supabase
          .from("ticket_scans")
          .select("id")
          .eq("ticket_id", data.id)
          .eq("scan_date", today)
          .maybeSingle();
        nextState = scanData ? "scanned_today" : "valid";
      } else {
        nextState = data.is_used ? "used" : "valid";
      }

      setPageState(nextState);

      const ev = data.events;
      let currentMode: "standard" | "express" = "standard";
      if (ev) {
        const locked = ev.scanner_mode_locked || false;
        const mode = ev.scanner_mode || "standard";
        
        setScannerModeLocked(locked);
        
        // Always respect the locked setting. 
        // If not locked, we still default to the event's mode on every scan/load 
        // as per the requirement "not freely toggled by the scanner operator".
        setScannerMode(mode);
        currentMode = mode;
      }

      const guestName = data.guest_name || `Ref: ${data.reference}`;
      const tierName = data.ticket_tiers?.name || "Ticket";

      if (nextState !== "valid") {
        setRecentScans(prev => [{
          id: Date.now().toString(),
          guestName,
          tierName,
          status: nextState === "not_found" ? "invalid" : "used",
          timestamp: new Date()
        }, ...prev].slice(0, 10));
      } else if (currentMode === "express") {
        executeCheckIn(data as TicketData);
      }
    }

    fetchTicket();
  }, [qrToken, searchParams, supabase]);

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
    if (pageState === "valid" && scannerMode === "standard") {
      playFeedbackSound("success");
      color = "rgba(34, 197, 94, 0.4)"; // Bright green
    } else if (pageState === "used" || pageState === "not_found" || pageState === "scanned_today") {
      playFeedbackSound("error");
      color = "rgba(239, 68, 68, 0.4)"; // Red
      
      if (scannerMode === "express") {
        setFlash({ color, active: true });
        const timer = setTimeout(() => {
          setFlash(null);
          setTicket(null);
          setPageState("idle");
          navigate("/verify", { replace: true });
        }, 800);
        return () => clearTimeout(timer);
      }
    }

    if (color && scannerMode === "standard") {
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
        setFlash(null);
        setTicket(null);
        setPageState("idle");
        setIsJustMarked(false);
        setCountdown(null);
        navigate("/verify", { replace: true });
      }, scannerMode === "express" ? 100 : 500);
      return () => clearTimeout(resetTimer);
    }
  }, [countdown, navigate, scannerMode]);

  const executeCheckIn = async (targetTicket: TicketData) => {
    if (!supabase) return;
    setMarking(true);

    const isMultiDay = targetTicket.events?.is_multi_day;
    const guestName = targetTicket.guest_name || `Ref: ${targetTicket.reference}`;
    const tierName = targetTicket.ticket_tiers?.name || "Ticket";

    try {
      if (!navigator.onLine) {
        SyncQueue.push({
          id: targetTicket.id,
          ticket_code: targetTicket.ticket_code,
          scanned_at: new Date().toISOString()
        });
        
        finishCheckIn(targetTicket, guestName, tierName, "success", true);
        return;
      }

      if (isMultiDay) {
        const today = new Date().toISOString().split('T')[0];
        const { error: scanError } = await supabase
          .from("ticket_scans")
          .insert({
            ticket_id: targetTicket.id,
            event_id: targetTicket.event_id,
            scan_date: today,
            scanner_id: user?.id ?? null,
          });

        if (scanError) {
          if (scanError.code === '23505') {
            setPageState("scanned_today");
            toast.warning("This ticket was already scanned today.");
            addRecentScan(guestName, tierName, "used");
            triggerExpressError();
          } else {
            throw scanError;
          }
          return;
        }

        finishCheckIn(targetTicket, guestName, tierName, "success");
      } else {
        const { data, error } = await supabase.rpc("mark_ticket_used", {
          p_ticket_code: targetTicket.ticket_code,
        });

        if (error) throw error;

        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        await fetch("https://hxvgoavigoopcgbmvltf.supabase.co/functions/v1/rotate-qr-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ ticketId: targetTicket.id }),
        }).catch(err => console.warn("Failed to rotate QR token offline", err));

        finishCheckIn(targetTicket, guestName, tierName, "success");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to mark ticket as used");
      triggerExpressError();
    } finally {
      setMarking(false);
    }
  };

  const addRecentScan = (guestName: string, tierName: string, status: "success" | "used" | "invalid") => {
    setRecentScans(prev => [{
      id: Date.now().toString(),
      guestName,
      tierName,
      status,
      timestamp: new Date()
    }, ...prev].slice(0, 10));
  };

  const triggerExpressError = () => {
    if (scannerMode === "express") {
      playFeedbackSound("error");
      setFlash({ color: "rgba(239, 68, 68, 1)", active: true });
      setTimeout(() => {
        setFlash(null);
        setTicket(null);
        setPageState("idle");
        navigate("/verify", { replace: true });
      }, 800);
    }
  };

  const finishCheckIn = (t: TicketData, guestName: string, tierName: string, status: "success", isOffline = false) => {
    scanCountRef.current += 1;
    setDisplayScanCount(scanCountRef.current);
    addRecentScan(guestName, tierName, status);
    
    if (scannerMode === "express") {
      playFeedbackSound("success");
      setFlash({ color: "rgba(34, 197, 94, 1)", active: true });
      
      setTimeout(() => {
        setFlash(null);
        setTicket(null);
        setPageState("idle");
        navigate("/verify", { replace: true });
      }, 800);
    } else {
      setIsPendingSync(isOffline);
      setTicket((prev) => prev ? { ...prev, is_used: true, used_at: new Date().toISOString() } : prev);
      setPageState("used");
      setIsJustMarked(true);
      setCountdown(3);
      if (isOffline) {
        toast.success("Ticket verified offline. It will sync when connection returns.");
      } else {
        toast.success("Ticket marked as used successfully");
      }
    }
  };

  const handleModeChange = (mode: "standard" | "express") => {
    setScannerMode(mode);
  };

  const handleMarkUsed = () => {
    if (ticket) executeCheckIn(ticket);
  };

  const ScannerModeToggle = () => (
    <div className="w-full max-w-md mx-auto mb-6 bg-white/80 backdrop-blur-md rounded-2xl p-4 border shadow-sm z-10 relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-neutral-800">Scanner Mode</h3>
        {scannerModeLocked && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A7A4A] bg-[#1A7A4A]/5 px-2.5 py-1 rounded-full border border-[#1A7A4A]/20">
            <Lock className="w-3.5 h-3.5" />
            Locked
          </div>
        )}
      </div>
      
      {scannerModeLocked ? (
        <div className="flex flex-col items-center justify-center gap-2 py-4 bg-[#1A7A4A]/5 border border-[#1A7A4A]/10 rounded-xl mb-2">
          <span className="font-black text-lg text-[#1A7A4A] uppercase tracking-wider">
            {scannerMode === "express" ? "Express Mode" : "Standard Mode"}
          </span>
          <div className="text-xs font-semibold text-neutral-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Mode locked by organizer
          </div>
        </div>
      ) : (
        <div className="flex bg-neutral-100 p-1 rounded-xl mb-3 relative">
          <button
            onClick={() => handleModeChange("standard")}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 z-10",
              scannerMode === "standard" ? "text-white" : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            STANDARD
          </button>
          <button
            onClick={() => handleModeChange("express")}
            className={cn(
              "flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 z-10",
              scannerMode === "express" ? "text-white" : "text-neutral-500 hover:text-neutral-700"
            )}
          >
            EXPRESS
          </button>
          <div 
            className={cn(
              "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#1A7A4A] rounded-lg shadow-sm transition-transform duration-300 ease-in-out",
              scannerMode === "express" ? "translate-x-[calc(100%+8px)]" : "translate-x-0"
            )}
          />
        </div>
      )}
      <p className="text-xs text-neutral-500 text-center font-medium">
        {scannerMode === "standard" 
          ? "Review guest info before checking in" 
          : "Auto check-in on scan — no tap needed"}
      </p>
    </div>
  );

  const RecentScansStrip = () => (
    <>
      {/* Mobile Drawer Toggle */}
      <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <button 
          onClick={() => setIsRecentScansExpanded(!isRecentScansExpanded)}
          className="bg-neutral-900 text-white px-5 py-3 rounded-full shadow-xl flex items-center gap-2 font-bold text-sm border border-neutral-700 hover:bg-neutral-800 transition-colors"
        >
          <Clock className="w-4 h-4" />
          Recent Scans
          {recentScans.length > 0 && (
            <span className="bg-[#1A7A4A] text-white text-xs px-2 py-0.5 rounded-full ml-1">
              {recentScans.length}
            </span>
          )}
          <ChevronUp className={cn("w-4 h-4 transition-transform duration-300 ml-1", isRecentScansExpanded && "rotate-180")} />
        </button>
      </div>

      {/* Desktop Sidebar / Mobile Drawer */}
      <div className={cn(
        "fixed bg-white border-border shadow-2xl z-40 transition-all duration-500 flex flex-col",
        // Desktop styles: fixed sidebar on the right
        "lg:top-0 lg:right-0 lg:bottom-0 lg:w-80 lg:border-l lg:translate-y-0",
        // Mobile styles: bottom drawer
        "bottom-0 left-0 right-0 rounded-t-3xl border-t max-h-[70vh]",
        isRecentScansExpanded ? "translate-y-0" : "translate-y-full lg:translate-y-0"
      )}>
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-white/80 backdrop-blur-md z-10 lg:rounded-none rounded-t-3xl">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#1A7A4A]" />
            <h2 className="font-bold text-neutral-900">Recent Scans</h2>
          </div>
          {recentScans.length > 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-bold">
              {recentScans.length} scanned
            </Badge>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3 relative bg-neutral-50/50">
          {recentScans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-neutral-400">
              <Clock className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">No recent scans yet</p>
            </div>
          ) : (
            recentScans.map((scan, i) => (
              <div 
                key={scan.id} 
                className={cn(
                  "p-3 rounded-xl border bg-white shadow-sm flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-500",
                  i === 0 && "border-[#1A7A4A]/30 ring-1 ring-[#1A7A4A]/10"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-neutral-900 truncate flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    {scan.guestName}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5 truncate font-medium">
                    {scan.tierName}
                  </div>
                  <div className="text-[10px] text-neutral-400 mt-1.5 uppercase tracking-wider font-bold">
                    {formatDistanceToNow(scan.timestamp, { addSuffix: true })}
                  </div>
                </div>
                <div className="shrink-0 mt-0.5">
                  {scan.status === "success" && (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                      ✓ Checked In
                    </Badge>
                  )}
                  {scan.status === "used" && (
                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">
                      ✗ Already Used
                    </Badge>
                  )}
                  {scan.status === "invalid" && (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
                      ✗ Invalid
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Mobile Drawer Overlay */}
      {isRecentScansExpanded && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-30 animate-in fade-in"
          onClick={() => setIsRecentScansExpanded(false)}
        />
      )}
    </>
  );

  // ── Idle / Waiting for Scan ──
  if (pageState === "idle") {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4 overflow-hidden relative">
        <ScanCounter count={displayScanCount} />
        <RecentScansStrip />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />
        
        <div className="w-full max-w-md flex flex-col relative z-10 pt-10 lg:pt-0">
          <ScannerModeToggle />
          
          <div className="text-center space-y-8 mt-4">
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
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 relative">
        <ScanCounter count={displayScanCount} />
        <RecentScansStrip />
        
        <div className="w-full max-w-md relative z-10 pt-10 lg:pt-0">
          <ScannerModeToggle />
          
          <div className="w-full bg-white rounded-2xl shadow-sm border p-6 sm:p-8 text-center overflow-hidden">
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
            <div className="text-center">
              <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">← Back to Tixora</Link>
            </div>
          </div>
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
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8 sm:py-12 w-full overflow-x-hidden relative">
        <ScanCounter count={displayScanCount} />
        <RecentScansStrip />
        
        <div className="w-full max-w-md relative z-10 pt-10 lg:pt-0">
          <ScannerModeToggle />
          
          <div className="w-full bg-white rounded-2xl shadow-sm border p-6 sm:p-8 overflow-hidden">
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

            <div className="text-center">
              <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">← Back to Tixora</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Used ──
  if (pageState === "used") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8 sm:py-12 w-full overflow-x-hidden relative">
        <ScanCounter count={displayScanCount} />
        <RecentScansStrip />
        
        <div className="w-full max-w-md relative z-10 pt-10 lg:pt-0">
          <ScannerModeToggle />
          
          <div className="w-full bg-white rounded-2xl shadow-sm border p-6 sm:p-8 overflow-hidden">
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

            <div className="text-center">
              <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">← Back to Tixora</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Valid / Render Body ──
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8 sm:py-12 w-full overflow-x-hidden relative">
      <ScanCounter count={displayScanCount} />
      <RecentScansStrip />
      {isOfflineMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-100 border-b border-amber-200 py-2.5 px-4 text-center">
          <p className="text-sm font-bold text-amber-800 flex items-center justify-center gap-2">
            <span>⚡ Offline Mode</span>
            <span className="font-normal opacity-80 decoration-dotted underline">Local cache being used</span>
          </p>
        </div>
      )}
      
      <div className="w-full max-w-md relative z-10 pt-10 lg:pt-0">
        <ScannerModeToggle />

        <div className="w-full bg-white rounded-2xl shadow-sm border p-6 sm:p-8 overflow-hidden">
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
                <Link to={`/login?redirect=/verify${queryToken ? `?token=${queryToken}` : `/${qrToken}`}`}>
                  <Button variant="outline" size="sm" className="border-primary text-primary">
                    Log in
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}

        <div className="text-center">
          <Link to="/" className="mt-6 inline-block text-sm text-primary hover:underline">← Back to Tixora</Link>
        </div>
      </div>
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

      {/* Debug UI (Subtle) */}
      <div className="fixed bottom-2 left-2 right-2 z-[10000] pointer-events-none flex flex-col items-center">
        <div className="bg-black/80 text-white/40 text-[10px] px-3 py-1 rounded-full backdrop-blur-sm flex gap-4">
          <span>Raw: {debugRaw || "none"}</span>
          <span>Token: {debugToken || "none"}</span>
        </div>
      </div>
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

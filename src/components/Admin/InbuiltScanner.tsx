import { useEffect, useState, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, Flashlight, CheckCircle, XCircle } from "lucide-react";
import { validateTicketOffline, getUnsyncedCount } from "@/lib/db";
import { useSync } from "@/hooks/useSync";
import { Button } from "@/components/ui/button";

import { extractTicketToken } from "@/lib/scanner";
import { cn } from "@/lib/utils";

interface InbuiltScannerProps {
  onClose: () => void;
  eventId?: string;
}

// Audio context helper for beep/buzz sounds
const playSound = (type: "beep" | "buzz") => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  if (type === "beep") {
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } else {
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }
};

export const InbuiltScanner = ({ onClose, eventId }: InbuiltScannerProps) => {
  const [scanResult, setScanResult] = useState<"success" | "already-used" | "invalid" | "invalid-event" | "error" | null>(null);
  const [scannerMode, setScannerMode] = useState<"standard" | "express">("standard");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isFlashlightOn, setIsFlashlightOn] = useState(false);
  const [hasFlashlight, setHasFlashlight] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanning = useRef(false);
  
  const { forceSync, isSyncing } = useSync();

  // Load unsynced count
  const loadUnsyncedCount = async () => {
    const count = await getUnsyncedCount();
    setUnsyncedCount(count);
  };

  useEffect(() => {
    loadUnsyncedCount();
    const interval = setInterval(loadUnsyncedCount, 5000);
    return () => clearInterval(interval);
  }, []);

  const [mode, setMode] = useState<"online" | "offline">("online");
  
  // ── Duplicate Scan Prevention ──
  const lastScannedCode = useRef("");
  const lastScanTime = useRef(0);
  
  useEffect(() => {
    const handleOnline = () => setMode("online");
    const handleOffline = () => setMode("offline");
    
    // Check initial state
    if (!navigator.onLine) setMode("offline");
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const initScanner = async () => {
      try {
        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;

        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          // Check if camera supports torch (approximation based on typical mobile devices)
          setHasFlashlight(true); 
          
          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 10, // Optimized scan speed (100ms interval)
              qrbox: 320,
              aspectRatio: 1.0,
              formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            },
            async (decodedText) => {
              // 1. Validation: Ignore empty or obviously invalid scans early
              if (!decodedText || decodedText.trim().length < 10) {
                return;
              }

              // 2. Debounce: Only process the same QR code once every 1.5 seconds
              const now = Date.now();
              if (decodedText === lastScannedCode.current && now - lastScanTime.current < 1500) {
                return;
              }

              // 3. Lock: Prevent multiple concurrent verification attempts
              if (isScanning.current) return;
              
              // ── Token Extraction Logic ──
              const token = extractTicketToken(decodedText);

              // Final check on extracted token
              if (!token || token.length < 5) return;

              // Record scan to prevent immediate re-trigger
              lastScannedCode.current = decodedText;
              lastScanTime.current = now;
              isScanning.current = true;

              console.log(`[Scanner] Raw: "${decodedText}" -> Extracted: "${token}"`);
              
              try {
                const result = await validateTicketOffline(token, eventId);
                
                if (result.success) {
                  setScanResult("success");
                  playSound("beep");
                  
                  if (scannerMode === "express") {
                    setTimeout(() => {
                      setScanResult(null);
                      setErrorMsg(null);
                      isScanning.current = false;
                    }, 800);
                  }
                } else {
                  // Determine specific error state
                  if (result.message?.toLowerCase().includes("already used")) {
                    setScanResult("already-used");
                  } else if (result.message?.toLowerCase().includes("different event")) {
                    setScanResult("invalid-event");
                  } else if (result.message?.toLowerCase().includes("invalid ticket")) {
                    setScanResult("invalid");
                  } else {
                    setScanResult("error");
                    setErrorMsg(result.message || "Unknown error");
                  }
                  playSound("buzz");
                }

                loadUnsyncedCount();
                
                // We no longer use a timeout to reset. 
                // The user must click "Confirm / Next" to resume.

              } catch (err: any) {
                console.error("[Scanner] Verification Error:", err);
                setScanResult("error");
                setErrorMsg(err.message || "Verification failed");
                playSound("buzz");
              }
            },
            (error) => {
              // Ignore noisy frame errors
            }
          );
        }
      } catch (err) {
        console.error("Failed to start scanner", err);
      }
    };

    initScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [scannerMode]);

  const toggleFlashlight = async () => {
    if (!scannerRef.current) return;
    try {
      const state = !isFlashlightOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: state }] as any
      });
      setIsFlashlightOn(state);
    } catch (err) {
      console.warn("Flashlight not supported", err);
    }
  };

  return (
    <div className="relative w-full min-h-[calc(100vh-64px)] bg-black flex flex-col items-center justify-center overflow-hidden">
      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 w-full bg-gradient-to-b from-black/80 to-transparent">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={onClose}>
          <X className="h-6 w-6" />
        </Button>
        {hasFlashlight && (
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={toggleFlashlight}>
            <Flashlight className={`h-6 w-6 ${isFlashlightOn ? 'text-yellow-400' : ''}`} />
          </Button>
        )}
      </div>

      {/* Standard/Express Toggle */}
      <div className="w-full max-w-md mb-4 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20">
        <div className="flex bg-white/10 p-1 rounded-xl relative">
          <button
            onClick={() => setScannerMode("standard")}
            className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 z-10",
              scannerMode === "standard" ? "text-white" : "text-white/50")}
          >STANDARD</button>
          <button
            onClick={() => setScannerMode("express")}
            className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 z-10",
              scannerMode === "express" ? "text-white" : "text-white/50")}
          >EXPRESS</button>
          <div className={cn(
            "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#1A7A4A] rounded-lg shadow-sm transition-transform duration-300 ease-in-out",
            scannerMode === "express" ? "translate-x-[calc(100%+8px)]" : "translate-x-0"
          )} />
        </div>
        <p className="text-xs text-white/50 text-center font-medium mt-2">
          {scannerMode === "standard" ? "Review result before next scan" : "Auto-continue after each scan"}
        </p>
      </div>

      {/* Reader Container */}
      <div className="relative w-full max-w-md aspect-square bg-black/50 overflow-hidden border-2 border-white/10 rounded-3xl">
        <div id="reader" className="w-full h-full object-cover"></div>
        
        {/* Scanning Frame / Overlay */}
        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
           <div className="w-[320px] h-[320px] border-2 border-white/50 rounded-2xl relative">
              {/* Corner Markers */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
           </div>
        </div>
        
        {/* Success/Error Overlay */}
        {scanResult && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 backdrop-blur-md transition-all duration-300 p-6 text-center">
            {scanResult === "success" ? (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-green-500/90 text-white p-8 rounded-full shadow-[0_0_50px_rgba(34,197,94,0.6)] animate-in zoom-in spin-in-12">
                  <CheckCircle className="h-20 w-20" />
                </div>
                <span className="text-white font-black text-2xl tracking-widest uppercase animate-in fade-in slide-in-from-bottom-4">Checked In</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className={cn(
                  "text-white p-8 rounded-full shadow-lg animate-in zoom-in fade-in",
                  scanResult === "already-used" ? "bg-amber-500/90 shadow-amber-500/40" : "bg-red-500/90 shadow-red-500/40"
                )}>
                  <XCircle className="h-20 w-20" />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-white font-black text-xl tracking-widest uppercase">
                    {scanResult === "already-used" ? "Already Used" : 
                     scanResult === "invalid-event" ? "Wrong Event" :
                     scanResult === "invalid" ? "Invalid Ticket" : "Scan Failed"}
                  </span>
                  {errorMsg && (
                    <span className="text-white/70 text-sm font-medium mt-1 animate-in fade-in">
                      {errorMsg}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Manual Confirmation Buttons */}
            <div className="mt-8 flex flex-col gap-3 w-full max-w-[240px]">
              <Button 
                onClick={() => {
                  setScanResult(null);
                  setErrorMsg(null);
                  isScanning.current = false;
                }}
                className="w-full bg-white text-black hover:bg-white/90 font-bold h-12 rounded-xl"
              >
                ✅ Confirm / Next
              </Button>
              <Button 
                variant="ghost"
                onClick={onClose}
                className="w-full text-white hover:bg-white/10 font-medium h-12 rounded-xl"
              >
                ❌ Dismiss / Close
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-8 text-center text-white/70 flex flex-col items-center gap-2">
        <p>Position QR Code in the frame</p>
        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 mt-2">
          <div className={`mr-2 h-2 w-2 rounded-full ${mode === "online" ? "bg-green-500" : "bg-neutral-500"}`} />
          <span className="text-xs uppercase tracking-wider">{mode} MODE</span>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center bg-gradient-to-t from-black/90 to-transparent w-full">
        <div className="flex items-center gap-4 text-sm font-medium">
          <div className="bg-white/10 px-4 py-2 rounded-full border border-white/20 text-white">
            Unsynced Scans: <span className="font-bold text-primary">{unsyncedCount}</span>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={forceSync} 
            disabled={isSyncing || unsyncedCount === 0 || !navigator.onLine}
            className="bg-primary/20 border-primary/50 text-white hover:bg-primary/40 hover:text-white"
          >
            {isSyncing ? "Syncing..." : "Force Sync"}
          </Button>
        </div>
        {!navigator.onLine && (
          <p className="text-red-400 text-xs mt-3 bg-red-400/10 px-3 py-1 rounded-full border border-red-400/20">
            You are offline. Scans saved locally.
          </p>
        )}
      </div>
    </div>
  );
};

import { useEffect, useState, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { X, Flashlight, CheckCircle, XCircle } from "lucide-react";
import { validateTicketOffline, getUnsyncedCount } from "@/lib/db";
import { useSync } from "@/hooks/useSync";
import { Button } from "@/components/ui/button";

interface InbuiltScannerProps {
  onClose: () => void;
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

export const InbuiltScanner = ({ onClose }: InbuiltScannerProps) => {
  const [scanResult, setScanResult] = useState<"success" | "error" | null>(null);
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
              fps: 15,
              qrbox: 250,
              aspectRatio: 1.0,
              formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            },
            async (decodedText) => {
              if (isScanning.current || !decodedText || decodedText.trim().length < 5) return;
              isScanning.current = true;

              try {
                const result = await validateTicketOffline(decodedText);
                
                if (result.success) {
                  setScanResult("success");
                  playSound("beep");
                } else {
                  setScanResult("error");
                  playSound("buzz");
                }

                loadUnsyncedCount();
                
                // Auto reset
                setTimeout(() => {
                  setScanResult(null);
                  isScanning.current = false;
                }, 1500);

              } catch (err) {
                console.error(err);
                setScanResult("error");
                playSound("buzz");
                
                setTimeout(() => {
                  setScanResult(null);
                  isScanning.current = false;
                }, 1500);
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
  }, []);

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

      {/* Reader Container */}
      <div className="relative w-full max-w-md aspect-square bg-black/50 overflow-hidden">
        <div id="reader" className="w-full h-full object-cover"></div>
        
        {/* Success/Error Overlay */}
        {scanResult && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 backdrop-blur-md transition-all duration-300">
            {scanResult === "success" ? (
              <div className="bg-green-500/90 text-white p-8 rounded-full shadow-[0_0_50px_rgba(34,197,94,0.6)] animate-in zoom-in spin-in-12">
                <CheckCircle className="h-24 w-24" />
              </div>
            ) : (
              <div className="bg-red-500/90 text-white p-8 rounded-full shadow-[0_0_50px_rgba(239,68,68,0.6)] animate-in zoom-in fade-in">
                <XCircle className="h-24 w-24" />
              </div>
            )}
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

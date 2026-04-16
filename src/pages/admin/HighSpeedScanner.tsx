import { useNavigate, useParams } from "react-router-dom";
import { InbuiltScanner } from "@/components/Admin/InbuiltScanner";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { syncTicketsToLocal } from "@/lib/db";
import { toast } from "sonner";
import { Loader2, DownloadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HighSpeedScannerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [eventTitle, setEventTitle] = useState("");

  useEffect(() => {
    async function fetchEventDetails() {
      if (!id) return;
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const { data, error } = await supabase
        .from("events")
        .select("title")
        .eq("id", id)
        .single();

      if (!error && data) {
        setEventTitle(data.title);
      }
    }
    fetchEventDetails();
  }, [id]);

  const handleSync = async () => {
    if (!id) return;
    setIsSyncing(true);
    try {
      await syncTicketsToLocal(id);
      toast.success("Guest list synced successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to sync guest list");
    } finally {
      setIsSyncing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Use a simple layout that centers the scanner
  return (
    <div className="min-h-screen bg-black flex flex-col pt-0">
      {/* Optional: Simple header with event title and sync status */}
      <div className="bg-neutral-900/50 border-b border-white/10 px-6 py-3 flex items-center justify-between text-white">
        <div>
          <h1 className="text-sm font-bold truncate max-w-[200px]">{eventTitle || "High-Speed Scanner"}</h1>
          <p className="text-[10px] text-white/50">Scanner active · Offline-ready</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleSync} 
          disabled={isSyncing}
          className="h-8 gap-1.5 border-white/20 bg-white/5 hover:bg-white/10 text-xs"
        >
          {isSyncing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <DownloadCloud className="h-3 w-3" />
          )}
          {isSyncing ? "Syncing..." : "Sync List"}
        </Button>
      </div>

      <div className="flex-1 relative">
        <InbuiltScanner onClose={() => navigate(`/events/${id}`)} />
      </div>
    </div>
  );
}

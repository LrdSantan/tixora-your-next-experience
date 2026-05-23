import { useEffect, useState } from "react";
import { X, AlertTriangle, Info, AlertCircle, CheckCircle2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type AlertType = "warning" | "info" | "error" | "success";

interface PlatformAlert {
  id: string;
  message: string;
  type: AlertType;
  is_active: boolean;
  created_at: string;
}

export default function PlatformAlertBanner() {
  const [alert, setAlert] = useState<PlatformAlert | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    async function fetchActiveAlert() {
      const supabase = getSupabaseClient();
      if (!supabase) return;

      try {
        const { data, error } = await supabase
          .from("platform_alerts")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          console.error("Error fetching platform alerts:", error);
          return;
        }

        if (data && data.length > 0) {
          const activeAlert = data[0] as PlatformAlert;
          // Check if this alert was dismissed in the current session
          const isDismissed = sessionStorage.getItem(`dismissed_alert_${activeAlert.id}`);
          if (!isDismissed) {
            setAlert(activeAlert);
            // Small timeout to trigger transition
            setTimeout(() => setVisible(true), 50);
          }
        }
      } catch (err) {
        console.error("Unexpected error fetching platform alerts:", err);
      }
    }

    fetchActiveAlert();
  }, []);

  const handleDismiss = () => {
    if (alert) {
      sessionStorage.setItem(`dismissed_alert_${alert.id}`, "true");
      setVisible(false);
      // Wait for transition before removing from state
      setTimeout(() => setAlert(null), 300);
    }
  };

  if (!alert) return null;

  // Background and text colors based on alert type
  const colorClasses = {
    warning: "bg-amber-500 text-amber-950 border-amber-600",
    info: "bg-blue-600 text-white border-blue-700",
    error: "bg-red-600 text-white border-red-700",
    success: "bg-green-600 text-white border-green-700",
  };

  const icons = {
    warning: <AlertTriangle className="w-5 h-5 shrink-0" />,
    info: <Info className="w-5 h-5 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 shrink-0" />,
    success: <CheckCircle2 className="w-5 h-5 shrink-0" />,
  };

  return (
    <div
      className={`w-full border-b text-sm font-semibold py-3 px-4 flex items-center justify-between transition-all duration-300 ease-in-out transform ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      } ${colorClasses[alert.type] || colorClasses.info}`}
      style={{
        zIndex: 9999,
        position: "relative",
      }}
    >
      <div className="flex-1 flex items-center justify-center gap-2">
        {icons[alert.type]}
        <span className="text-center">{alert.message}</span>
      </div>
      <button
        onClick={handleDismiss}
        className="p-1 rounded-full hover:bg-black/10 transition-colors focus:outline-none"
        aria-label="Dismiss Alert"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

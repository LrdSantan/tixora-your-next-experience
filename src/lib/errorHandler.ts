import { toast } from "sonner";

let offlineToastId: string | number | null = null;

export const handleSupabaseError = (error: any) => {
  console.error("[supabase error]", error);
  toast.error("Something went wrong. Please try again.");
};

export const showSlowRequestWarning = () => {
  toast.warning("This is taking longer than usual...", {
    duration: 5000,
  });
};

export const showPaymentError = () => {
  toast.error("Payment could not be processed. Please try again or contact support.");
};

export const setupNetworkListeners = () => {
  window.addEventListener('offline', () => {
    offlineToastId = toast.error("You're offline. Check your connection.", {
      duration: Infinity,
    });
  });

  window.addEventListener('online', () => {
    if (offlineToastId) {
      toast.dismiss(offlineToastId);
      offlineToastId = null;
    }
    toast.success("Back online!", { duration: 3000 });
  });
};

import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getSupabaseClient } from "@/lib/supabase";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const WalletPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ticketCode = searchParams.get("ticket");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generatePass = async () => {
      if (!ticketCode) {
        setError("Invalid ticket code.");
        return;
      }

      try {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error("Supabase not configured");

        // Fetch ticket ID by code
        const { data: ticket, error: ticketError } = await supabase
          .from("tickets")
          .select("id")
          .eq("ticket_code", ticketCode)
          .single();

        if (ticketError || !ticket) throw new Error("Ticket not found.");

        // Call edge function
        const { data, error: functionError } = await supabase.functions.invoke("create-google-wallet-pass", {
          body: { ticket_id: ticket.id },
        });

        if (functionError || (data && !data.success)) {
          throw new Error(data?.error || "Failed to generate wallet pass.");
        }

        // Redirect to Google Wallet
        if (data?.wallet_url) {
          window.location.href = data.wallet_url;
        } else {
          throw new Error("No wallet URL returned.");
        }
      } catch (err: any) {
        console.error("[Wallet] Error:", err);
        setError(err.message || "Could not generate wallet pass. Please try again.");
      }
    };

    generatePass();
  }, [ticketCode]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="bg-destructive/10 text-destructive p-4 rounded-full mb-4">
          <X className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold mb-2">Generation Failed</h1>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <Loader2 className="w-12 h-12 animate-spin text-primary mb-6" />
      <h1 className="text-2xl font-bold mb-2">Generating Pass...</h1>
      <p className="text-muted-foreground">We're preparing your Google Wallet ticket. Please wait.</p>
    </div>
  );
};

export default WalletPage;

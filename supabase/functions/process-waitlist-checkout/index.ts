import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing env vars");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const { token, tier_id } = body ?? {};

    if (!token || !tier_id) {
      return json({ error: "token and tier_id are required" }, 400);
    }

    // Find the waitlist entry
    const { data: entry, error: findError } = await supabase
      .from("waitlist")
      .select("id, event_id, tier_id, guest_name, guest_email, status, expires_at")
      .eq("checkout_token", token)
      .eq("tier_id", tier_id)
      .eq("status", "notified")
      .maybeSingle();

    if (findError) throw findError;

    if (!entry) {
      return json({ error: "Invalid or expired waitlist token" }, 404);
    }

    // Check if the offer has expired
    if (entry.expires_at && new Date(entry.expires_at) < new Date()) {
      // Mark as expired
      await supabase
        .from("waitlist")
        .update({ status: "expired" })
        .eq("id", entry.id);

      // Notify the next person — fire and forget
      fetch(`${supabaseUrl}/functions/v1/notify-next-waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ tier_id }),
      }).catch((e) => console.error("[process-waitlist-checkout] notify-next failed:", e));

      return json({ error: "This offer has expired. The next person has been notified." }, 410);
    }

    // Valid token — return checkout data
    return json({
      success: true,
      event_id: entry.event_id,
      tier_id: entry.tier_id,
      guest_name: entry.guest_name,
      guest_email: entry.guest_email,
    });

  } catch (err: any) {
    console.error("[process-waitlist-checkout] Fatal error:", err);
    return json({ error: err.message || "Unexpected error" }, 500);
  }
});

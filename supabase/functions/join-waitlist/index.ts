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
    const { event_id, tier_id, guest_name, guest_email } = body ?? {};

    if (!event_id || !tier_id || !guest_name || !guest_email) {
      return json({ error: "Missing required fields: event_id, tier_id, guest_name, guest_email" }, 400);
    }

    // 1. Validate tier exists and belongs to event
    const { data: tier, error: tierError } = await supabase
      .from("ticket_tiers")
      .select("id, event_id, name, total_quantity, remaining_quantity, waitlist_enabled")
      .eq("id", tier_id)
      .eq("event_id", event_id)
      .single();

    if (tierError || !tier) {
      return json({ error: "Tier not found or does not belong to this event" }, 404);
    }

    // 2. Check waitlist is enabled for this tier
    if (!tier.waitlist_enabled) {
      return json({ error: "Waitlist is not enabled for this tier" }, 400);
    }

    // 3. Check tier is actually sold out
    if (tier.remaining_quantity > 0) {
      return json({ error: "This tier still has available tickets" }, 400);
    }

    // 4. Check if guest is already on the waitlist for this tier
    const { data: existing } = await supabase
      .from("waitlist")
      .select("id")
      .eq("tier_id", tier_id)
      .eq("guest_email", guest_email.toLowerCase().trim())
      .eq("status", "waiting")
      .maybeSingle();

    if (existing) {
      return json({ error: "You are already on the waitlist for this tier" }, 409);
    }

    // 5. Get current position (count of waiting entries + 1)
    const { count: waitingCount } = await supabase
      .from("waitlist")
      .select("*", { count: "exact", head: true })
      .eq("tier_id", tier_id)
      .eq("status", "waiting");

    const position = (waitingCount ?? 0) + 1;

    // 6. Insert into waitlist
    const { data: entry, error: insertError } = await supabase
      .from("waitlist")
      .insert({
        event_id,
        tier_id,
        guest_name: guest_name.trim(),
        guest_email: guest_email.toLowerCase().trim(),
        position,
        status: "waiting",
      })
      .select("id, position")
      .single();

    if (insertError) throw insertError;

    return json({ success: true, position: entry.position });

  } catch (err: any) {
    console.error("[join-waitlist] Fatal error:", err);
    return json({ error: err.message || "Unexpected error" }, 500);
  }
});

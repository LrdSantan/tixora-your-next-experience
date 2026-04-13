import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

/*
 * To run this automatically daily:
 * Option 1: Supabase pg_cron
 *   select cron.schedule('auto-expire-events', '0 0 * * *', $$
 *     select net.http_post(
 *       url:='https://<project-ref>.supabase.co/functions/v1/auto-expire-events',
 *       headers:='{"Content-Type": "application/json"}'::jsonb
 *     );
 *   $$);
 * 
 * Option 2: External cron like cron-job.org
 *   Set a daily POST request to https://<project-ref>.supabase.co/functions/v1/auto-expire-events
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("events")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("date", today)
      .select("id");

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true, count: data?.length || 0, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

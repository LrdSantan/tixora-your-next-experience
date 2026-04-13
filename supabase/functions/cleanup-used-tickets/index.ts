import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// To set up a daily cron job for this endpoint, go to cron-job.org and 
// point it to: https://hxvgoavigoopcgbmvltf.supabase.co/functions/v1/cleanup-used-tickets
// Use a GET or POST request.

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE environment variables");
    }

    // Must use service role key to bypass RLS and delete rows safely
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete tickets that are used and using a time older than 24 hours
    // Supabase JS allows comparing dates but the exact "interval" logic is better 
    // done correctly. We can compute the 24 hours ago date in JS.
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: deletedRows, error } = await supabase
      .from("tickets")
      .delete()
      .eq("is_used", true)
      .lt("used_at", twentyFourHoursAgo)
      .select("id"); // Select deleted IDs to count them

    if (error) {
      console.error("Error deleting tickets:", error);
      throw error;
    }

    const count = deletedRows?.length || 0;

    return new Response(JSON.stringify({ deleted: count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});

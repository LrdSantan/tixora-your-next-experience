import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ✅ FIX: Verify secret token before doing anything
    const cleanupSecret = Deno.env.get("CLEANUP_SECRET");
    const incomingSecret = req.headers.get("x-cleanup-secret");

    if (!cleanupSecret || incomingSecret !== cleanupSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: deletedRows, error } = await supabase
      .from("tickets")
      .delete()
      .eq("is_used", true)
      .lt("used_at", twentyFourHoursAgo)
      .select("id");

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
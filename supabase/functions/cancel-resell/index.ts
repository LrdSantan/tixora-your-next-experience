import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOG = "[cancel-resell]";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders: Record<string, string> = {
  "Content-Type": "application/json",
  ...corsHeaders,
};

function errorResponse(
  errorMessage: string,
  status: number,
  details?: Record<string, unknown>,
): Response {
  const body: Record<string, unknown> = { ok: false, error: errorMessage };
  if (details && Object.keys(details).length > 0) body.details = details;
  try {
    return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
  } catch (stringifyErr) {
    console.error(`${LOG} JSON.stringify failed in errorResponse`, stringifyErr);
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { status, headers: jsonHeaders },
    );
  }
}

function successResponse(data: unknown): Response {
  try {
    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: jsonHeaders });
  } catch (stringifyErr) {
    console.error(`${LOG} JSON.stringify failed in successResponse`, stringifyErr);
    return errorResponse("Could not serialize response", 500);
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    try {
      // ── 1. Auth ────────────────────────────────────────────────────────────
      const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
      console.error(`${LOG} JWT: Authorization header present=${Boolean(authHeader)}`);

      if (!authHeader?.startsWith("Bearer ")) {
        const msg = "Missing or invalid Authorization header (expected Bearer token)";
        console.error(`${LOG} JWT: ${msg}`);
        return errorResponse(msg, 401);
      }

      const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!jwt) {
        console.error(`${LOG} JWT: empty token after Bearer prefix`);
        return errorResponse("Empty bearer token", 401);
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
        const missing = [
          !supabaseUrl && "SUPABASE_URL",
          !supabaseAnonKey && "SUPABASE_ANON_KEY",
          !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
        ].filter(Boolean);
        console.error(`${LOG} Env check failed, missing: ${missing.join(", ") || "(unknown)"}`);
        return errorResponse("Server misconfigured", 500, { missing: missing.join(", ") });
      }

      // Use anon client with user's JWT forwarded for auth verification only
      const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });

      console.error(`${LOG} JWT: auth.getUser() via anon client (token length=${jwt.length})`);
      const {
        data: { user },
        error: userError,
      } = await anonClient.auth.getUser(authHeader.replace(/Bearer /i, ""));

      if (userError) {
        console.error(`${LOG} JWT: getUser() failed`, {
          message: userError.message,
          name: userError.name,
          status: userError.status,
        });
        return errorResponse(userError.message || "Invalid or expired session", 401, {
          status: userError.status,
        });
      }

      if (!user) {
        console.error(`${LOG} JWT: getUser returned no user`);
        return errorResponse("Invalid session (no user)", 401);
      }

      console.error(`${LOG} JWT: OK user_id=${user.id} email=${user.email ?? "(none)"}`);

      // ── 2. Parse body ──────────────────────────────────────────────────────
      let body: { ticket_id?: string };
      try {
        body = (await req.json()) as { ticket_id?: string };
      } catch (parseErr) {
        console.error(`${LOG} Body JSON parse failed`, parseErr);
        return errorResponse("Invalid JSON body", 400, {
          details: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
      }

      const ticket_id = body.ticket_id?.trim();
      if (!ticket_id) {
        console.error(`${LOG} Validation: ticket_id missing`);
        return errorResponse("ticket_id is required", 400);
      }

      // ── 3. Service-role client for all DB operations (bypasses RLS) ────────
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // ── 4. Fetch ticket ────────────────────────────────────────────────────
      console.error(`${LOG} Fetching ticket id=${ticket_id}`);
      const { data: ticket, error: ticketError } = await admin
        .from("tickets")
        .select("id, user_id, resell_status")
        .eq("id", ticket_id)
        .maybeSingle();

      if (ticketError) {
        console.error(`${LOG} DB: ticket fetch failed`, ticketError);
        return errorResponse("Failed to fetch ticket", 500, { details: ticketError.message });
      }

      if (!ticket) {
        console.error(`${LOG} Ticket not found id=${ticket_id}`);
        return errorResponse("Ticket not found", 404);
      }

      // ── 5. Ownership check ─────────────────────────────────────────────────
      if (ticket.user_id !== user.id) {
        console.error(
          `${LOG} Ownership mismatch ticket.user_id=${ticket.user_id} user.id=${user.id}`,
        );
        return errorResponse("You do not own this ticket", 403);
      }

      // ── 6. Resell status guard ─────────────────────────────────────────────
      if (ticket.resell_status !== "pending") {
        console.error(
          `${LOG} Cannot cancel — resell_status=${ticket.resell_status} for ticket id=${ticket_id}`,
        );
        return errorResponse(
          "No pending resell request found for this ticket",
          400,
        );
      }

      // ── 7. Generate new qr_token ───────────────────────────────────────────
      const newQrToken = crypto.randomUUID();
      console.error(`${LOG} Generated new qr_token for ticket id=${ticket_id}`);

      // ── 8. Update tickets row ──────────────────────────────────────────────
      const { error: ticketUpdateError } = await admin
        .from("tickets")
        .update({
          resell_status: null,
          resell_requested_at: null,
          qr_token: newQrToken,
        })
        .eq("id", ticket_id);

      if (ticketUpdateError) {
        console.error(`${LOG} DB: tickets update failed`, ticketUpdateError);
        return errorResponse("Failed to update ticket", 500, {
          details: ticketUpdateError.message,
        });
      }

      // ── 9. Cancel pending resell row ───────────────────────────────────────
      const { error: resellUpdateError } = await admin
        .from("ticket_resells")
        .update({ status: "cancelled" })
        .eq("ticket_id", ticket_id)
        .eq("status", "pending");

      if (resellUpdateError) {
        console.error(`${LOG} DB: ticket_resells update failed`, resellUpdateError);
        return errorResponse("Failed to cancel resell record", 500, {
          details: resellUpdateError.message,
        });
      }

      console.error(`${LOG} Success — resell cancelled for ticket_id=${ticket_id} user_id=${user.id}`);

      // ── 10. Return success ─────────────────────────────────────────────────
      return successResponse({
        success: true,
        message: "Resell cancelled. Your ticket has been reactivated.",
      });
    } catch (innerErr) {
      const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
      const stack = innerErr instanceof Error ? innerErr.stack : undefined;
      console.error(`${LOG} Inner handler error`, { errorMessage, stack, innerErr });
      return errorResponse(errorMessage || "Unexpected error", 500, stack ? { stack } : undefined);
    }
  } catch (outerErr) {
    const errorMessage = outerErr instanceof Error ? outerErr.message : String(outerErr);
    console.error(`${LOG} Outer fatal error`, outerErr);
    return new Response(JSON.stringify({ ok: false, error: errorMessage || "Fatal error" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});

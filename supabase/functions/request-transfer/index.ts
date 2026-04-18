import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOG = "[request-transfer]";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
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
      const siteUrl =
        Deno.env.get("SITE_URL") ?? "https://tixoraafrica.com.ng";

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
      let body: { ticket_id?: string; method?: string; to_email?: string };
      try {
        body = await req.json();
      } catch (parseErr) {
        console.error(`${LOG} Body JSON parse failed`, parseErr);
        return errorResponse("Invalid JSON body", 400, {
          details: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
      }

      const ticket_id = body.ticket_id?.trim();
      const method = body.method?.trim();
      const to_email = body.to_email?.trim() || null;

      // ── 3. Required field validation ───────────────────────────────────────
      if (!ticket_id || !method) {
        const missing = [!ticket_id && "ticket_id", !method && "method"].filter(Boolean);
        console.error(`${LOG} Validation: missing fields: ${missing.join(", ")}`);
        return errorResponse(`Missing required fields: ${missing.join(", ")}`, 400);
      }

      if (method !== "email" && method !== "link") {
        console.error(`${LOG} Validation: invalid method=${method}`);
        return errorResponse("method must be 'email' or 'link'", 400);
      }

      // ── 4. Email method requires to_email ──────────────────────────────────
      if (method === "email" && !to_email) {
        console.error(`${LOG} Validation: to_email required for method=email`);
        return errorResponse("to_email is required when method is 'email'", 400);
      }

      // ── 5. Service-role client for all DB operations (bypasses RLS) ────────
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // ── 6. Fetch ticket ────────────────────────────────────────────────────
      console.error(`${LOG} Fetching ticket id=${ticket_id}`);
      const { data: ticket, error: ticketFetchError } = await admin
        .from("tickets")
        .select("id, user_id, status, resell_status, transfer_status, amount_paid")
        .eq("id", ticket_id)
        .maybeSingle();

      if (ticketFetchError) {
        console.error(`${LOG} DB: ticket fetch failed`, ticketFetchError);
        return errorResponse("Failed to fetch ticket", 500, { details: ticketFetchError.message });
      }

      if (!ticket) {
        console.error(`${LOG} Ticket not found id=${ticket_id}`);
        return errorResponse("Ticket not found", 404);
      }

      // ── 7. Ownership check ─────────────────────────────────────────────────
      if (ticket.user_id !== user.id) {
        console.error(
          `${LOG} Ownership mismatch ticket.user_id=${ticket.user_id} user.id=${user.id}`,
        );
        return errorResponse("You do not own this ticket", 403);
      }

      // ── 8. Usage guard ─────────────────────────────────────────────────────
      if (ticket.status === "used") {
        console.error(`${LOG} Ticket already used id=${ticket_id}`);
        return errorResponse("Cannot transfer a used ticket", 400);
      }

      // ── 9. Resell guard ────────────────────────────────────────────────────
      if (ticket.resell_status === "pending") {
        console.error(`${LOG} Ticket has pending resell id=${ticket_id}`);
        return errorResponse("Cannot transfer a ticket that is listed for resell", 400);
      }

      // ── 10. Duplicate transfer guard ───────────────────────────────────────
      if (ticket.transfer_status === "pending") {
        console.error(`${LOG} Ticket already has pending transfer id=${ticket_id}`);
        return errorResponse("This ticket already has a pending transfer", 400);
      }

      // ── 11. Fee calculation ────────────────────────────────────────────────
      const fee_amount = 200; // Flat ₦200 transfer fee
      console.error(
        `${LOG} Fee calc: fixed fee_amount=${fee_amount}`,
      );

      // ── 12. Generate transfer token & expiry ───────────────────────────────
      const transfer_token = crypto.randomUUID();
      const transfer_token_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      console.error(
        `${LOG} Generated transfer_token expires_at=${transfer_token_expires_at}`,
      );

      // ── 13. Insert into ticket_transfers ───────────────────────────────────
      const { error: transferInsertError } = await admin.from("ticket_transfers").insert({
        ticket_id,
        from_user_id: user.id,
        to_email: to_email,
        method,
        transfer_token,
        fee_amount,
        status: "pending",
      });

      if (transferInsertError) {
        console.error(`${LOG} DB: ticket_transfers insert failed`, transferInsertError);
        return errorResponse("Failed to create transfer request", 500, {
          details: transferInsertError.message,
        });
      }

      // ── 14. Update tickets table ───────────────────────────────────────────
      const { error: ticketUpdateError } = await admin
        .from("tickets")
        .update({
          transfer_status: "pending",
          transfer_token,
          transfer_token_expires_at,
          original_owner_email: user.email,
        })
        .eq("id", ticket_id);

      if (ticketUpdateError) {
        console.error(`${LOG} DB: tickets update failed`, ticketUpdateError);
        return errorResponse("Failed to update ticket transfer status", 500, {
          details: ticketUpdateError.message,
        });
      }

      // ── 15. Build claim URL ────────────────────────────────────────────────
      const claim_url = `${siteUrl}/claim-ticket/${transfer_token}`;
      console.error(
        `${LOG} Success ticket_id=${ticket_id} method=${method} claim_url=${claim_url}`,
      );

      // ── 16. Return success ─────────────────────────────────────────────────
      return successResponse({
        success: true,
        transfer_token,
        claim_url,
        fee_amount,
        method,
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

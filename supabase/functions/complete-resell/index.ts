import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOG = "[complete-resell]";

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
      } = await anonClient.auth.getUser();

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
      let body: { ticket_resell_id?: string; new_buyer_id?: string; paystack_reference?: string };
      try {
        body = await req.json();
      } catch (parseErr) {
        console.error(`${LOG} Body JSON parse failed`, parseErr);
        return errorResponse("Invalid JSON body", 400, {
          details: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
      }

      const ticket_resell_id = body.ticket_resell_id?.trim();
      const new_buyer_id = body.new_buyer_id?.trim();
      const paystack_reference = body.paystack_reference?.trim();

      if (!ticket_resell_id || !new_buyer_id || !paystack_reference) {
        const missing = [
          !ticket_resell_id && "ticket_resell_id",
          !new_buyer_id && "new_buyer_id",
          !paystack_reference && "paystack_reference",
        ].filter(Boolean);
        console.error(`${LOG} Validation: missing fields: ${missing.join(", ")}`);
        return errorResponse(`Missing required fields: ${missing.join(", ")}`, 400);
      }

      // ── 3. Service-role client for all DB operations (bypasses RLS) ────────
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // ── 4. Fetch ticket_resells row ────────────────────────────────────────
      console.error(`${LOG} Fetching ticket_resell id=${ticket_resell_id}`);
      const { data: resell, error: resellFetchError } = await admin
        .from("ticket_resells")
        .select("id, ticket_id, status, requested_by, original_amount, refund_amount, fee_amount, fee_percentage")
        .eq("id", ticket_resell_id)
        .maybeSingle();

      if (resellFetchError) {
        console.error(`${LOG} DB: ticket_resells fetch failed`, resellFetchError);
        return errorResponse("Failed to fetch resell record", 500, {
          details: resellFetchError.message,
        });
      }

      if (!resell) {
        console.error(`${LOG} ticket_resell not found id=${ticket_resell_id}`);
        return errorResponse("Resell record not found", 404);
      }

      // ── 5. Resell status guard ─────────────────────────────────────────────
      if (resell.status !== "pending") {
        console.error(`${LOG} Resell not pending — status=${resell.status}`);
        return errorResponse(
          `Resell is not available for completion (status: ${resell.status})`,
          400,
        );
      }

      // ── 6. Fetch associated ticket ─────────────────────────────────────────
      console.error(`${LOG} Fetching ticket id=${resell.ticket_id}`);
      const { data: ticket, error: ticketFetchError } = await admin
        .from("tickets")
        .select("id, resell_status, ticket_code, event_id, amount_paid")
        .eq("id", resell.ticket_id)
        .maybeSingle();

      if (ticketFetchError) {
        console.error(`${LOG} DB: ticket fetch failed`, ticketFetchError);
        return errorResponse("Failed to fetch ticket", 500, { details: ticketFetchError.message });
      }

      if (!ticket) {
        console.error(`${LOG} Ticket not found id=${resell.ticket_id}`);
        return errorResponse("Associated ticket not found", 404);
      }

      // ── 7. Ticket resell_status guard ──────────────────────────────────────
      if (ticket.resell_status !== "pending") {
        console.error(`${LOG} Ticket resell_status not pending — status=${ticket.resell_status}`);
        return errorResponse(
          `Ticket is not in a resellable state (resell_status: ${ticket.resell_status})`,
          400,
        );
      }

      // ── 8. Fetch event details for email ───────────────────────────────────
      console.error(`${LOG} Fetching event id=${ticket.event_id}`);
      const { data: event, error: eventFetchError } = await admin
        .from("events")
        .select("id, title, venue, city, date, time")
        .eq("id", ticket.event_id)
        .maybeSingle();

      if (eventFetchError) {
        console.error(`${LOG} DB: event fetch failed`, eventFetchError);
        return errorResponse("Failed to fetch event", 500, { details: eventFetchError.message });
      }

      if (!event) {
        console.error(`${LOG} Event not found id=${ticket.event_id}`);
        return errorResponse("Associated event not found", 404);
      }

      // ── 9. Generate new qr_token ───────────────────────────────────────────
      const newQrToken = crypto.randomUUID();
      console.error(`${LOG} Generated new qr_token for ticket id=${resell.ticket_id}`);

      // ── 10. Update tickets table — transfer ownership ──────────────────────
      const { error: ticketUpdateError } = await admin
        .from("tickets")
        .update({
          resell_status: "completed",
          user_id: new_buyer_id,
          qr_token: newQrToken,
          resell_requested_at: null,
        })
        .eq("id", resell.ticket_id);

      if (ticketUpdateError) {
        console.error(`${LOG} DB: tickets update failed`, ticketUpdateError);
        return errorResponse("Failed to transfer ticket ownership", 500, {
          details: ticketUpdateError.message,
        });
      }

      // ── 11. Update ticket_resells — mark completed ─────────────────────────
      const { error: resellUpdateError } = await admin
        .from("ticket_resells")
        .update({
          status: "completed",
          new_buyer_id,
          completed_at: new Date().toISOString(),
        })
        .eq("id", ticket_resell_id);

      if (resellUpdateError) {
        console.error(`${LOG} DB: ticket_resells update failed`, resellUpdateError);
        return errorResponse("Failed to mark resell as completed", 500, {
          details: resellUpdateError.message,
        });
      }

      // ── 12. Add to admin payout queue ──────────────────────────────────────
      console.error(`${LOG} Adding payout record to queue for seller id=${resell.requested_by}`);
      try {
        const { error: payoutError } = await admin
          .from("admin_payout_queue")
          .insert({
            ticket_id: resell.ticket_id,
            seller_id: resell.requested_by,
            amount_owed: resell.refund_amount,
            fee_amount: resell.fee_amount,
            original_amount: resell.original_amount,
            paystack_reference: paystack_reference,
            status: "pending",
            created_at: new Date().toISOString(),
          });

        if (payoutError) {
          console.error(`${LOG} Non-fatal: Failed to insert into admin_payout_queue`, payoutError);
        } else {
          console.error(`${LOG} Payout record added successfully`);
        }
      } catch (payoutErr) {
        console.error(`${LOG} Non-fatal: Error adding to payout queue`, payoutErr);
      }

      // ── 13. Fetch new buyer's user details for email ───────────────────────
      console.error(`${LOG} Fetching new buyer user id=${new_buyer_id}`);
      const {
        data: { user: newBuyer },
        error: newBuyerError,
      } = await admin.auth.admin.getUserById(new_buyer_id);

      if (newBuyerError || !newBuyer) {
        // Non-fatal — log and skip email rather than failing the whole transfer
        console.error(`${LOG} Could not fetch new buyer details — skipping email`, newBuyerError);
      } else {
        // ── 14. Invoke send-ticket-email edge function ───────────────────────
        const functionsBaseUrl = `${supabaseUrl}/functions/v1`;
        const buyerName =
          newBuyer.user_metadata?.full_name ||
          newBuyer.user_metadata?.name ||
          newBuyer.email?.split("@")[0] ||
          "Ticket holder";

        const emailPayload = {
          type: "ticket_confirmation",
          buyerName,
          buyerEmail: newBuyer.email,
          eventTitle: event.title,
          purchasedAt: new Date().toISOString(),
          tickets: [
            {
              tierName: "Resold Ticket",
              quantity: 1,
              amountPaid: `₦${Number(resell.refund_amount).toLocaleString("en-NG", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`,
              venue: event.venue,
              city: event.city,
              date: event.date,
              time: event.time ?? "",
              reference: paystack_reference,
              ticketCode: ticket.ticket_code ?? "",
              qrToken: newQrToken,
            },
          ],
        };

        console.error(`${LOG} Invoking send-ticket-email for new buyer email=${newBuyer.email}`);
        try {
          const emailRes = await fetch(`${functionsBaseUrl}/send-ticket-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify(emailPayload),
          });

          const emailBody = await emailRes.json().catch(() => ({}));
          if (!emailRes.ok) {
            // Non-fatal — ticket is already transferred, just log the failure
            console.error(
              `${LOG} send-ticket-email returned non-OK status=${emailRes.status}`,
              emailBody,
            );
          } else {
            console.error(`${LOG} send-ticket-email OK`, emailBody);
          }
        } catch (emailErr) {
          // Non-fatal — ticket is already transferred
          console.error(`${LOG} send-ticket-email fetch threw`, emailErr);
        }
      }

      console.error(
        `${LOG} Success — ticket_id=${resell.ticket_id} transferred to new_buyer_id=${new_buyer_id}`,
      );

      // ── 15. Return success ─────────────────────────────────────────────────
      return successResponse({
        success: true,
        qr_token: newQrToken,
        message: "Ticket successfully transferred to new owner.",
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

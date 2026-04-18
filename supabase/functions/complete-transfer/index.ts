import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOG = "[complete-transfer]";

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
      const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");

      if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !paystackSecret) {
        const missing = [
          !supabaseUrl && "SUPABASE_URL",
          !supabaseAnonKey && "SUPABASE_ANON_KEY",
          !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
          !paystackSecret && "PAYSTACK_SECRET_KEY",
        ].filter(Boolean);
        console.error(`${LOG} Env check failed, missing: ${missing.join(", ") || "(unknown)"}`);
        return errorResponse("Server misconfigured", 500, { missing: missing.join(", ") });
      }

      // Use anon client with user's JWT forwarded for auth verification
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
      let body: { transfer_token?: string; payment_reference?: string };
      try {
        body = await req.json();
      } catch (parseErr) {
        console.error(`${LOG} Body JSON parse failed`, parseErr);
        return errorResponse("Invalid JSON body", 400, {
          details: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
      }

      const transfer_token = body.transfer_token?.trim();
      const payment_reference = body.payment_reference?.trim();

      if (!transfer_token || !payment_reference) {
        console.error(`${LOG} Validation: transfer_token or payment_reference missing`);
        return errorResponse("transfer_token and payment_reference are required", 400);
      }

      // ── 3. Service-role client for all DB operations ───────────────────────
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      // ── 4. Fetch ticket by transfer_token ──────────────────────────────────
      console.error(`${LOG} Fetching ticket for transfer_token=${transfer_token}`);
      const { data: ticket, error: ticketFetchError } = await admin
        .from("tickets")
        .select("id, user_id, transfer_status, transfer_token_expires_at, ticket_code, event_id, amount_paid")
        .eq("transfer_token", transfer_token)
        .maybeSingle();

      if (ticketFetchError) {
        console.error(`${LOG} DB: ticket fetch failed`, ticketFetchError);
        return errorResponse("Failed to fetch ticket", 500, { details: ticketFetchError.message });
      }

      if (!ticket) {
        console.error(`${LOG} Ticket not found for token=${transfer_token}`);
        return errorResponse("Transfer link is invalid or ticket not found", 404);
      }

      // ── 5. Transfer status guard ───────────────────────────────────────────
      if (ticket.transfer_status !== "pending") {
        console.error(`${LOG} Ticket transfer_status not pending — status=${ticket.transfer_status}`);
        return errorResponse("This transfer is no longer pending", 400);
      }

      // ── 6. Expiry check ─────────────────────────────────────────────────────
      const now = new Date();
      const expiresAt = new Date(ticket.transfer_token_expires_at);
      if (expiresAt < now) {
        console.error(`${LOG} Transfer link expired: expiresAt=${ticket.transfer_token_expires_at} now=${now.toISOString()}`);
        
        // Update ticket to clear transfer info
        await admin.from("tickets")
          .update({ transfer_status: null, transfer_token: null, transfer_token_expires_at: null })
          .eq("id", ticket.id);
          
        // Update transfer record
        await admin.from("ticket_transfers")
          .update({ status: "expired" })
          .eq("transfer_token", transfer_token)
          .eq("status", "pending");

        return errorResponse("Transfer link has expired", 400);
      }

      // ── 7. Self-transfer guard ─────────────────────────────────────────────
      if (user.id === ticket.user_id) {
        console.error(`${LOG} Self-transfer attempt: user_id=${user.id} ticket.user_id=${ticket.user_id}`);
        return errorResponse("You cannot transfer a ticket to yourself", 400);
      }

      // ── 8. Paystack Verification ───────────────────────────────────────────
      console.error(`${LOG} Verifying Paystack payment_reference=${payment_reference}`);
      const verifyUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(payment_reference)}`;
      
      let verifyRes: Response;
      try {
        verifyRes = await fetch(verifyUrl, {
          headers: { Authorization: `Bearer ${paystackSecret}` },
        });
      } catch (fetchErr) {
        console.error(`${LOG} Paystack verify API request failed`, fetchErr);
        return errorResponse("Payment verification failed due to network error.", 502);
      }

      let verifyJson: any;
      try {
        verifyJson = await verifyRes.json();
      } catch (parseErr) {
        console.error(`${LOG} Paystack response is not JSON`);
        return errorResponse("Payment verification failed. Invalid response from gateway.", 502);
      }

      if (!verifyRes.ok || !verifyJson.status || verifyJson.data?.status !== "success") {
        console.error(`${LOG} Paystack verification failed`, verifyJson);
        return errorResponse("Payment verification failed. Fee of ₦200 is required.", 400);
      }

      const amountKobo = verifyJson.data?.amount;
      if (amountKobo !== 20000) {
        console.error(`${LOG} Paystack verification failed. Incorrect amount=${amountKobo} (expected 20000)`);
        return errorResponse("Payment verification failed. Incorrect amount. Fee of ₦200 is required.", 400);
      }

      console.error(`${LOG} Paystack payment valid! amount=${amountKobo} status=${verifyJson.data?.status}`);

      // ── 8. Fetch event details for email ───────────────────────────────────
      const { data: event, error: eventFetchError } = await admin
        .from("events")
        .select("id, title, venue, city, date, time")
        .eq("id", ticket.event_id)
        .maybeSingle();

      if (eventFetchError || !event) {
        console.error(`${LOG} DB: event fetch failed or missing`, eventFetchError);
        return errorResponse("Failed to fetch event details", 500);
      }

      // ── 9. Generate new qr_token and update tables ─────────────────────────
      const newQrToken = crypto.randomUUID();
      console.error(`${LOG} Completing transfer for ticket_id=${ticket.id} to new_owner=${user.id}`);

      // Update tickets table
      const { error: ticketUpdateError } = await admin
        .from("tickets")
        .update({
          user_id: user.id,
          qr_token: newQrToken,
          transfer_status: "completed",
          transferred_to_email: user.email,
          transfer_token: null,
          transfer_token_expires_at: null,
        })
        .eq("id", ticket.id);

      if (ticketUpdateError) {
        console.error(`${LOG} DB: tickets update failed`, ticketUpdateError);
        return errorResponse("Failed to complete ticket transfer", 500, {
          details: ticketUpdateError.message,
        });
      }

      // Update ticket_transfers table
      const { error: transferUpdateError } = await admin
        .from("ticket_transfers")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("transfer_token", transfer_token)
        .eq("status", "pending");

      if (transferUpdateError) {
        console.error(`${LOG} DB: ticket_transfers update failed`, transferUpdateError);
        // Non-fatal since ticket is already transferred
      }

      // ── 10. Invoke send-ticket-email ────────────────────────────────────────
      const functionsBaseUrl = `${supabaseUrl}/functions/v1`;
      const buyerName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Ticket holder";

      const emailPayload = {
        type: "ticket_confirmation",
        buyerName,
        buyerEmail: user.email,
        eventTitle: event.title,
        purchasedAt: new Date().toISOString(),
        tickets: [
          {
            tierName: "Transferred Ticket",
            quantity: 1,
            amountPaid: `₦${(Number(ticket.amount_paid) / 100).toLocaleString("en-NG", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            venue: event.venue,
            city: event.city,
            date: event.date,
            time: event.time ?? "",
            reference: `TRANS-${ticket.id.slice(0, 8)}`,
            ticketCode: ticket.ticket_code ?? "",
            qrToken: newQrToken,
          },
        ],
      };

      try {
        console.error(`${LOG} Invoking send-ticket-email for new owner email=${user.email}`);
        const emailRes = await fetch(`${functionsBaseUrl}/send-ticket-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify(emailPayload),
        });

        if (!emailRes.ok) {
          const emailBody = await emailRes.json().catch(() => ({}));
          console.error(`${LOG} send-ticket-email failed status=${emailRes.status}`, emailBody);
        } else {
          console.error(`${LOG} send-ticket-email OK`);
        }
      } catch (emailErr) {
        console.error(`${LOG} send-ticket-email fetch exception`, emailErr);
      }

      console.error(`${LOG} Success — ticket_id=${ticket.id} transferred to user_id=${user.id}`);

      return successResponse({
        success: true,
        qr_token: newQrToken,
        message: "Ticket successfully claimed.",
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

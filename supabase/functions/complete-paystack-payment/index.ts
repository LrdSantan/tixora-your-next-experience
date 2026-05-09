import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOG = "[complete-paystack-payment]";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders: Record<string, string> = {
  "Content-Type": "application/json",
  ...corsHeaders,
};

type Body = {
  reference?: string;
  lines?: { tier_id: string; quantity: number }[];
  coupon_code?: string;
  // Guest / friend purchase fields
  guest_email?: string;
  guest_name?: string;
  guest_phone?: string;
  recipient_email?: string; // set when buyer is buying for a friend
  is_free?: boolean;
  // Optional registration answers
  registration_answers?: { question_id: string; answer: string }[];
};

type PaystackVerifyData = {
  status?: string;
  amount?: number;
  reference?: string;
};

type PaystackVerifyResponse = {
  status: boolean;
  message?: string;
  data?: PaystackVerifyData;
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
      const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
      console.error(`${LOG} JWT: Authorization header present=${Boolean(authHeader)}`);

      let jwt = "";
      if (authHeader?.startsWith("Bearer ")) {
        jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      console.error(`${LOG} serviceRoleKey defined=${Boolean(serviceRoleKey)} length=${serviceRoleKey?.length ?? 0}`);
      const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");

      if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !paystackSecret) {
        const missing = [
          !supabaseUrl && "SUPABASE_URL",
          !supabaseAnonKey && "SUPABASE_ANON_KEY",
          !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
          !paystackSecret && "PAYSTACK_SECRET_KEY",
        ].filter(Boolean);
        console.error(`${LOG} Env check failed, missing: ${missing.join(", ") || "(unknown)"}`);
        return errorResponse("Server misconfigured", 500, {
          missing: missing.join(", "),
        });
      }

      let user = null;
      if (authHeader?.startsWith("Bearer ")) {
        const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
        if (jwt) {
          const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${jwt}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });

          console.error(`${LOG} JWT: auth.getUser() via anon client`);
          const { data: { user: foundUser } } = await anonClient.auth.getUser();
          user = foundUser;
          if (user) {
            console.error(`${LOG} JWT: OK user_id=${user.id} email=${user.email ?? "(none)"}`);
          }
        }
      }

      if (!user) {
        console.error(`${LOG} Proceeding as guest checkout (no valid user session)`);
      }

      let body: Body;
      try {
        body = (await req.json()) as Body;
        console.error(`${LOG} Received body:`, JSON.stringify(body, null, 2));
      } catch (parseErr) {
        console.error(`${LOG} Body JSON parse failed`, parseErr);
        return errorResponse("Invalid JSON body", 400, {
          details: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
      }

      const reference = body.reference?.trim();
      const lines = body.lines;
      const recipientEmail = body.recipient_email?.trim().toLowerCase() || null;

      if (!reference || !lines?.length) {
        console.error(`${LOG} Validation: reference or lines missing`, {
          reference: reference || null,
          hasLines: Boolean(lines),
          lineCount: lines?.length ?? 0,
        });
        return errorResponse("reference and lines are required", 400);
      }

      for (const line of lines) {
        if (!line.tier_id || !line.quantity || line.quantity < 1) {
          console.error(`${LOG} Validation: invalid line`, line);
          return errorResponse("Invalid line item", 400);
        }
      }

      let amountKoboInt = 0;
      let guestEmail: string | null = null;
      let guestName: string | null = null;
      let guestPhone: string | null = null;

      // Skip Paystack for Free Tickets
      if (reference.startsWith("FREE-")) {
        console.error(`${LOG} Detected free ticket order, skipping Paystack verification`);
        amountKoboInt = 0;
      } else {
        const verifyUrl = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
        console.error(`${LOG} Paystack: GET verify`, { reference, httpUrl: verifyUrl });

        let verifyRes: Response;
        try {
          verifyRes = await fetch(verifyUrl, {
            headers: { Authorization: `Bearer ${paystackSecret}` },
          });
        } catch (fetchErr) {
          console.error(`${LOG} Paystack: fetch failed`, fetchErr);
          return errorResponse("Paystack verify request failed", 502, {
            details: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
          });
        }

        let verifyRawText: string;
        try {
          verifyRawText = await verifyRes.text();
        } catch (textErr) {
          console.error(`${LOG} Paystack: read body failed`, textErr);
          return errorResponse("Could not read Paystack response", 502);
        }

        console.error(
          `${LOG} Paystack: HTTP status=${verifyRes.status} ok=${verifyRes.ok} body_length=${verifyRawText.length}`,
        );

        let verifyJson: PaystackVerifyResponse;
        try {
          verifyJson = JSON.parse(verifyRawText) as PaystackVerifyResponse;
        } catch (parseErr) {
          console.error(`${LOG} Paystack: response is not JSON`, {
            preview: verifyRawText.slice(0, 500),
            parseErr,
          });
          return errorResponse("Paystack returned non-JSON response", 502, {
            httpStatus: verifyRes.status,
            preview: verifyRawText.slice(0, 200),
          });
        }

        if (!verifyRes.ok) {
          console.error(`${LOG} Paystack: HTTP request failed`, verifyJson);
          return errorResponse(verifyJson.message ?? `Paystack HTTP ${verifyRes.status}`, 400, {
            httpStatus: verifyRes.status,
            paystack: verifyJson,
          });
        }

        if (!verifyJson.status || verifyJson.data?.status !== "success") {
          const msg = verifyJson.message ?? "Paystack verification failed (transaction not successful)";
          console.error(`${LOG} Paystack: transaction not successful. Full body:`, verifyRawText);
          return errorResponse(msg, 400, { paystack: verifyJson });
        }

        const amountKobo = verifyJson.data?.amount;
        if (amountKobo === undefined || amountKobo === null) {
          console.error(`${LOG} Paystack: missing amount in data`, verifyJson.data);
          return errorResponse("Missing amount from Paystack", 400);
        }

        amountKoboInt = Math.round(Number(amountKobo));
        console.error(`${LOG} Paystack: amount kobo (rounded)=${amountKoboInt}`);

        const paystackData = verifyJson.data as any;
        const metadata = paystackData?.metadata;
        const customFields = metadata?.custom_fields || [];
        guestName = customFields.find((f: any) => f.variable_name === "guest_name")?.value;
        guestPhone = customFields.find((f: any) => f.variable_name === "guest_phone")?.value;

        guestEmail =
          metadata?.guest_email ||
          paystackData?.customer?.email ||
          customFields.find((f: any) => f.variable_name === "guest_email")?.value ||
          null;
      }

      if (!user && !guestEmail) {
        // For FREE tickets passed via body
        if (reference.startsWith("FREE-")) {
          guestEmail = body.guest_email?.trim() || null;
          guestName = body.guest_name?.trim() || null;
          guestPhone = body.guest_phone?.trim() || null;
        }

        if (!guestEmail) {
          console.error(`${LOG} Guest checkout failed: Missing guest_email`);
          return errorResponse("Guest checkout requires email", 400);
        }
      }

      // For authenticated users buying for a friend, pick up body fields
      if (user && !guestEmail) {
        guestEmail = body.guest_email?.trim() || null;
        guestName = body.guest_name?.trim() || null;
        guestPhone = body.guest_phone?.trim() || null;
      }

      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const finalizedTickets: any[] = [];
      const remainingLines = lines;

      // Create new tickets via RPC
      if (remainingLines.length > 0) {
        console.error(`${LOG} RPC: finalise_purchase_after_payment for ${remainingLines.length} items`);
        const rpcArgs = {
          p_user_id: user?.id ?? null,
          p_reference: reference,
          p_verified_amount_kobo: amountKoboInt,
          p_items: remainingLines,
          p_guest_name: guestName,
          p_guest_email: guestEmail,
          p_guest_phone: guestPhone,
          p_recipient_email: recipientEmail,
          p_coupon_code: body.coupon_code || null,
        };

        const { data: rpcData, error: rpcError } = await admin.rpc("finalize_purchase_after_payment", rpcArgs);

        if (rpcError) {
          console.error(`${LOG} RPC failed`, rpcError);
          // If the error is about coupon usage limit, return it clearly
          const isCouponLimit = rpcError.message?.includes("usage limit") || rpcError.details?.includes("usage limit");
          const errorMsg = isCouponLimit ? "the coupon has reached its usage limit" : (rpcError.message ?? "Could not complete purchase");
          
          return errorResponse(errorMsg, 400, {
            code: rpcError.code,
            details: rpcError.details,
          });
        }

        if (rpcData?.tickets) {
          finalizedTickets.push(...rpcData.tickets);
        }
      }

      const rpcData = { tickets: finalizedTickets };

      // ── Save registration answers (non-blocking) ────────────────────────────
      const registrationAnswers = (body as any).registration_answers;
      if (
        Array.isArray(registrationAnswers) &&
        registrationAnswers.length > 0 &&
        finalizedTickets.length > 0
      ) {
        try {
          // Fetch the actual ticket row IDs for this reference
          const { data: ticketRows } = await admin
            .from("tickets")
            .select("id")
            .eq("reference", reference);

          const ticketIds: string[] = (ticketRows ?? []).map((r: any) => r.id);

          if (ticketIds.length > 0) {
            const answerRows = ticketIds.flatMap((ticketId) =>
              registrationAnswers
                .filter((a: any) => a.question_id && a.answer?.trim())
                .map((a: any) => ({
                  ticket_id: ticketId,
                  question_id: a.question_id,
                  answer: a.answer,
                }))
            );

            if (answerRows.length > 0) {
              const { error: answersError } = await admin
                .from("registration_answers")
                .upsert(answerRows, { onConflict: "ticket_id,question_id" });
              if (answersError) {
                console.error(`${LOG} Error saving registration_answers:`, answersError);
              }
            }
          }
        } catch (answersErr) {
          console.error(`${LOG} registration_answers save threw:`, answersErr);
        }
      }

      // Send ticket confirmation email
      if (finalizedTickets.length > 0) {
        try {
          // Determine recipient: friend's email takes priority for "buy for a friend",
          // otherwise use guest email or authenticated user's email.
          const emailRecipient = recipientEmail || guestEmail || user?.email;
          const recipientName = guestName || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Ticket buyer";
          const eventTitle = finalizedTickets[0].event_title || "Your Event";

          // Fetch all individual tickets for this reference from the DB to get the qr_code and other details
          const { data: allTickets, error: fetchError } = await admin
            .from("tickets")
            .select("*, ticket_tiers(name)")
            .eq("reference", reference);

          if (fetchError) {
            console.error(`${LOG} Error fetching tickets for email:`, fetchError);
          }

          const ticketsToProcess = allTickets && allTickets.length > 0 ? allTickets : finalizedTickets;

          const emailTickets = ticketsToProcess.map((t: any) => ({
            tierName: t.tier_name || t.ticket_tiers?.name || "General Admission",
            quantity: t.quantity || 1,
            amountPaid: `₦${(Number(t.amount_paid || 0) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            venue: t.venue || finalizedTickets[0]?.venue || "Venue",
            city: t.city || finalizedTickets[0]?.city || "",
            date: t.date || finalizedTickets[0]?.date || "",
            time: t.time || finalizedTickets[0]?.time || "",
            reference: t.reference || reference,
            ticketCode: t.ticket_code,
            qrToken: t.qr_token || t.ticket_code,
            qrCode: t.qr_code // Use the stored qr_code value from DB
          }));

          const emailPayload = {
            type: "ticket_confirmation",
            buyerName: recipientName,
            buyerEmail: emailRecipient,
            eventTitle,
            purchasedAt: new Date().toISOString(),
            tickets: emailTickets
          };

          const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-ticket-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify(emailPayload),
          });

          if (!emailRes.ok) {
            console.error(`${LOG} send-ticket-email failed status=${emailRes.status}`);
          }
        } catch (emailErr) {
          console.error(`${LOG} Error sending email`, emailErr);
        }
      }

      // ── Post-purchase guest account setup (non-blocking fire-and-forget) ────
      // Determines who needs a guest account:
      //   1. Buying for a friend → set up account for recipient_email
      //   2. Guest checkout (no user session) → set up account for guestEmail
      // Existing auth users are excluded.
      const guestSetupEmail = recipientEmail || (!user ? guestEmail : null);
      const guestSetupName = guestName || guestSetupEmail?.split("@")[0] || "Guest";

      if (guestSetupEmail && finalizedTickets.length > 0) {
        const ticketIds = finalizedTickets.map((t: any) => t.id).filter(Boolean);
        const setupPayload = {
          guestEmail: guestSetupEmail,
          guestName: guestSetupName,
          eventTitle: finalizedTickets[0].event_title || "Your Event",
          ticketIds,
        };

        // Fire and forget — don't await, don't block response
        fetch(`${supabaseUrl}/functions/v1/post-purchase-guest-setup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify(setupPayload),
        }).then(async (r) => {
          if (!r.ok) {
            const body = await r.text().catch(() => "");
            console.error(`${LOG} post-purchase-guest-setup failed status=${r.status} body=${body}`);
          } else {
            console.error(`${LOG} post-purchase-guest-setup triggered for ${guestSetupEmail}`);
          }
        }).catch((err) => {
          console.error(`${LOG} post-purchase-guest-setup fetch error`, err);
        });
      }

      // ── Notify waitlist if any tier had inventory freed by a failed/cancelled prior reservation ──
      // (No-op if nobody is waiting — the edge function handles that gracefully)
      if (finalizedTickets.length > 0) {
        const uniqueTierIds = [...new Set(lines.map((l) => l.tier_id))];
        for (const tid of uniqueTierIds) {
          fetch(`${supabaseUrl}/functions/v1/notify-next-waitlist`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ tier_id: tid }),
          }).catch((err) => {
            console.error(`${LOG} notify-next-waitlist failed for tier ${tid}`, err);
          });
        }
      }

      return successResponse(rpcData);
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
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
        return errorResponse("Server misconfigured", 500, {
          missing: missing.join(", "),
        });
      }

      // Use anon client with the user's JWT forwarded — works correctly for Google OAuth tokens
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

      let body: Body;
      try {
        body = (await req.json()) as Body;
      } catch (parseErr) {
        console.error(`${LOG} Body JSON parse failed`, parseErr);
        return errorResponse("Invalid JSON body", 400, {
          details: parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
      }

      const reference = body.reference?.trim();
      const lines = body.lines;

      if (!reference || !lines?.length) {
        console.error(`${LOG} Validation: reference or lines missing`, {
          reference: reference || null,
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

      console.error(`${LOG} Paystack: parsed`, {
        paystack_status_field: verifyJson.status,
        message: verifyJson.message,
        data_status: verifyJson.data?.status,
        data_reference: verifyJson.data?.reference,
        amount: verifyJson.data?.amount,
      });

      if (!verifyRes.ok) {
        console.error(`${LOG} Paystack: HTTP request failed`, verifyJson);
        return errorResponse(verifyJson.message ?? `Paystack HTTP ${verifyRes.status}`, 400, {
          httpStatus: verifyRes.status,
          paystack: verifyJson,
        });
      }

      if (!verifyJson.status || verifyJson.data?.status !== "success") {
        const msg = verifyJson.message ?? "Paystack verification failed (transaction not successful)";
        console.error(`${LOG} Paystack: transaction not successful`, verifyJson);
        return errorResponse(msg, 400, { paystack: verifyJson });
      }

      const amountKobo = verifyJson.data?.amount;
      if (amountKobo === undefined || amountKobo === null) {
        console.error(`${LOG} Paystack: missing amount in data`, verifyJson.data);
        return errorResponse("Missing amount from Paystack", 400);
      }

      const amountKoboInt = Math.round(Number(amountKobo));
      console.error(`${LOG} Paystack: amount kobo (rounded)=${amountKoboInt}`);

      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const itemsPayload = lines.map((l) => ({
        tier_id: l.tier_id,
        quantity: l.quantity,
      }));

      const rpcArgs = {
        p_user_id: user.id,
        p_reference: reference,
        p_verified_amount_kobo: amountKoboInt,
        p_items: itemsPayload,
      };

      console.error(`${LOG} RPC: finalize_purchase_after_payment`, {
        p_user_id: rpcArgs.p_user_id,
        p_reference: rpcArgs.p_reference,
        p_verified_amount_kobo: rpcArgs.p_verified_amount_kobo,
        line_count: itemsPayload.length,
        p_items: itemsPayload,
      });

      let rpcData: unknown;
      let rpcError: { message: string; code?: string; details?: string; hint?: string } | null;
      try {
        const out = await admin.rpc("finalize_purchase_after_payment", rpcArgs);
        rpcData = out.data;
        rpcError = out.error;
      } catch (rpcThrow) {
        console.error(`${LOG} RPC threw`, rpcThrow);
        return errorResponse(
          rpcThrow instanceof Error ? rpcThrow.message : String(rpcThrow),
          400,
        );
      }

      if (rpcError) {
        console.error(`${LOG} RPC failed`, {
          message: rpcError.message,
          code: rpcError.code,
          details: rpcError.details,
          hint: rpcError.hint,
          full: JSON.stringify(rpcError),
        });
        return errorResponse(rpcError.message ?? "Could not complete purchase", 400, {
          code: rpcError.code,
          hint: rpcError.hint,
          details: rpcError.details,
        });
      }

      console.error(`${LOG} RPC OK`, {
        keys: rpcData && typeof rpcData === "object" ? Object.keys(rpcData as object) : rpcData,
      });

      if (body.coupon_code) {
        try {
          console.error(`${LOG} Applying coupon logic for: ${body.coupon_code}`);
          const { data: couponData } = await admin.from("coupons")
            .select("id, uses_count")
            .eq("code", body.coupon_code)
            .eq("is_active", true)
            .single();

          if (couponData) {
            await admin.from("coupons").update({ uses_count: (couponData.uses_count || 0) + 1 }).eq("id", couponData.id);
            await admin.from("tickets")
              .update({ coupon_code: body.coupon_code, coupon_id: couponData.id })
              .eq("reference", reference);
          }
        } catch (couponErr) {
          console.error(`${LOG} Failed to process coupon after success.`, couponErr);
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
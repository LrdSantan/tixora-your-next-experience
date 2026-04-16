import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOG = "[resolve-bank]";

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
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function successResponse(data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: jsonHeaders });
}

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    // 1. Auth check (forwarded JWT)
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("Missing Authorization header", 401);
    }

    const jwt = authHeader.replace(/Bearer /i, "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser(jwt);

    if (userError || !user) {
      console.error(`${LOG} Auth failed`, userError);
      return errorResponse("Unauthorized", 401);
    }

    // 2. Parse body
    const { account_number, bank_code } = await req.json();

    if (!account_number || !bank_code) {
      return errorResponse("account_number and bank_code are required", 400);
    }

    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      console.error(`${LOG} PAYSTACK_SECRET_KEY missing`);
      return errorResponse("Server misconfigured", 500);
    }

    // 3. Resolve account via Paystack
    console.log(`${LOG} Resolving ${account_number} for bank ${bank_code}`);
    
    const url = `https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    });

    const result = await response.json();

    if (!response.ok || !result.status) {
      console.error(`${LOG} Paystack error`, result);
      return errorResponse(result.message || "Failed to resolve account", response.status);
    }

    return successResponse(result.data);
    
  } catch (err: any) {
    console.error(`${LOG} Fatal error`, err);
    return errorResponse(err.message || "Internal server error", 500);
  }
});

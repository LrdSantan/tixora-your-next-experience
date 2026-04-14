import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOG = "[send-contact-email]";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { "Content-Type": "application/json", ...corsHeaders };

function errorResponse(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: msg }), { status, headers: jsonHeaders });
}

function successResponse(data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: jsonHeaders });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return errorResponse("RESEND_API_KEY not set", 500);

    const { name, email, subject, message } = await req.json();

    if (!name || !email || !subject || !message) {
      return errorResponse("Missing required fields");
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Tixora Support <onboarding@resend.dev>",
        to: ["yusufquadir50@gmail.com"],
        subject: `[Contact Form] ${subject} - from ${name}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #1A7A4A;">New Contact Form Message</h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
          </div>
        `,
      }),
    });

    const resendBody = await emailRes.json();
    console.log(`${LOG} Resend response`, resendBody);

    if (!emailRes.ok) {
      return errorResponse(resendBody?.message ?? "Resend API error", 502);
    }

    return successResponse({ emailId: resendBody.id });
  } catch (err) {
    console.error(`${LOG} Error`, err);
    return errorResponse(err instanceof Error ? err.message : "Unexpected error", 500);
  }
});

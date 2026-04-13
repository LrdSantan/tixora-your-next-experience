import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOG = "[send-review-notification]";

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

type Payload = {
  reviewer_email: string;
  event_title: string;
  rating: number;
  comment: string;
  event_id: string;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return errorResponse("RESEND_API_KEY not set", 500);

    const payload = await req.json() as Payload;

    if (!payload.reviewer_email || !payload.event_title || !payload.event_id || !payload.rating) {
      return errorResponse("Missing required fields");
    }

    const starString = "⭐".repeat(payload.rating);
    const eventUrl = `https://tixora-your-next-experience.vercel.app/events/${payload.event_id}`;

    const htmlContent = `
      <h2>New Review for ${payload.event_title}</h2>
      <p><strong>Reviewer:</strong> ${payload.reviewer_email}</p>
      <p><strong>Rating:</strong> ${starString} (${payload.rating}/5)</p>
      <p><strong>Comment:</strong><br/>${payload.comment || "No comment provided."}</p>
      <p><strong>Link:</strong> <a href="${eventUrl}">${eventUrl}</a></p>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Tixora <onboarding@resend.dev>",
        to: ["yusufquadir50@gmail.com"],
        subject: `New Review on Tixora: ${payload.event_title}`,
        html: htmlContent,
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

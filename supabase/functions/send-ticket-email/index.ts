import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOG = "[send-ticket-email]";

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

type EmailPayload = {
  type: "ticket_confirmation";
  buyerName: string;
  buyerEmail: string;
  eventTitle: string;
  tierName: string;
  quantity: number;
  amountPaid: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  reference: string;
  purchasedAt: string;
};

function ticketEmailHtml(p: EmailPayload): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4faf6;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        
        <!-- Header -->
        <tr><td style="background:#1A7A4A;padding:32px 40px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">🎟 TIXORA</p>
          <p style="margin:8px 0 0;color:#a8dfc0;font-size:14px;">Your ticket is confirmed</p>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:32px 40px 0;">
          <p style="margin:0;font-size:16px;color:#1a1a1a;">Hi <strong>${p.buyerName}</strong>,</p>
          <p style="margin:12px 0 0;font-size:15px;color:#555;line-height:1.6;">
            Your payment was successful and your ticket is ready. Here are your booking details:
          </p>
        </td></tr>

        <!-- Ticket Card -->
        <tr><td style="padding:24px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4faf6;border:1px solid #d0ead9;border-radius:12px;padding:24px;">
            <tr><td>
              <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1a1a1a;">${p.eventTitle}</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#888;width:140px;">Ticket type</td>
                  <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${p.tierName}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#888;">Quantity</td>
                  <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${p.quantity}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#888;">Amount paid</td>
                  <td style="padding:6px 0;font-size:13px;color:#1A7A4A;font-weight:700;">${p.amountPaid}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#888;">Venue</td>
                  <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${p.venue}, ${p.city}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#888;">Date</td>
                  <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${p.date}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#888;">Time</td>
                  <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${p.time}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#888;">Reference</td>
                  <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:monospace;">${p.reference}</td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 40px 32px;text-align:center;">
          <p style="margin:0 0 16px;font-size:14px;color:#888;">You can view and download your ticket from your Tixora account.</p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9f9f9;padding:20px 40px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
            © ${new Date().getFullYear()} Tixora · This is an automated email, please do not reply.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return errorResponse("RESEND_API_KEY not set", 500);

    const payload = await req.json() as EmailPayload;

    if (!payload.buyerEmail || !payload.eventTitle) {
      return errorResponse("Missing required fields");
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:"Tixora <onboarding@resend.dev>",
        to: [payload.buyerEmail],
        subject: `Your ticket for ${payload.eventTitle} ✓`,
        html: ticketEmailHtml(payload),
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
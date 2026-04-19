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

type TicketItem = {
  tierName: string;
  quantity: number;
  amountPaid: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  reference: string;
  ticketCode: string;
  qrToken: string;
};

type EmailPayload = {
  type: "ticket_confirmation";
  buyerName: string;
  buyerEmail: string;
  eventTitle: string;
  purchasedAt: string;
  tickets: TicketItem[];
};

function ticketEmailHtml(p: EmailPayload): string {
  const showQRCodes = p.tickets.length <= 3;

  const ticketsHtml = p.tickets.map((t, idx) => {
    // encodeURIComponent is safe for URL params
    const tokenToUse = t.qrToken || t.ticketCode;
    const verifyUrl = `https://tixoraafrica.com.ng/verify?token=${tokenToUse}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&ecc=H&qzone=4&data=${encodeURIComponent(verifyUrl)}`;

    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4faf6;border:1px solid #d0ead9;border-radius:12px;padding:24px;margin-bottom:16px;">
        <tr><td>
          <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1a1a1a;">${p.eventTitle} - Ticket ${idx + 1}</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#888;width:140px;">Ticket code</td>
              <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;font-family:monospace;">${t.ticketCode}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#888;">Ticket type</td>
              <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${t.tierName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#888;">Amount paid</td>
              <td style="padding:6px 0;font-size:13px;color:#1A7A4A;font-weight:700;">${t.amountPaid}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#888;">Venue</td>
              <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${t.venue}, ${t.city}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#888;">Date</td>
              <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${t.date}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#888;">Time</td>
              <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${t.time}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;color:#888;">Reference</td>
              <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:monospace;">${t.reference}</td>
            </tr>
          </table>
          
          ${showQRCodes ? `
            <div style="margin-top:24px;text-align:center;">
              <img src="${qrUrl}" alt="QR Code" width="150" height="150" style="display:block;margin:0 auto;border:4px solid #fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);"/>
            </div>
          ` : (idx === 0 ? `
            <div style="margin-top:24px;text-align:center;">
              <img src="${qrUrl}" alt="QR Code" width="150" height="150" style="display:block;margin:0 auto;border:4px solid #fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);"/>
              <p style="margin-top:16px;font-size:13px;color:#888;">View all your tickets at: <a href="https://tixoraafrica.com.ng/my-tickets" style="color:#1A7A4A;">My Tickets</a></p>
            </div>
          ` : ``)}
        </td></tr>
      </table>
    `;
  }).join('');

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
          <p style="margin:8px 0 0;color:#a8dfc0;font-size:14px;">Your order is confirmed</p>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:32px 40px 0;">
          <p style="margin:0;font-size:16px;color:#1a1a1a;">Hi <strong>${p.buyerName}</strong>,</p>
          <p style="margin:12px 0 0;font-size:15px;color:#555;line-height:1.6;">
            Your payment was successful and your tickets are ready. Here are your booking details:
          </p>
        </td></tr>

        <!-- Ticket Cards -->
        <tr><td style="padding:24px 40px;">
          ${ticketsHtml}
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 40px 32px;text-align:center;">
          <p style="margin:0 0 16px;font-size:14px;color:#888;">You can view and download all your tickets from your Tixora account anytime.</p>
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

    if (!payload.buyerEmail || !payload.eventTitle || !payload.tickets) {
      return errorResponse("Missing required fields");
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:"Tixora <tickets@tixoraafrica.com.ng>",
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
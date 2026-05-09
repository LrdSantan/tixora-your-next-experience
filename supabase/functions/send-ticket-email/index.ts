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
  qrCode?: string;
};

type TicketConfirmationPayload = {
  type: "ticket_confirmation";
  buyerName: string;
  buyerEmail: string;
  eventTitle: string;
  purchasedAt: string;
  tickets: TicketItem[];
};

type WelcomePayload = {
  type: "welcome";
  buyerName: string;
  buyerEmail: string;
};

type EmailPayload = TicketConfirmationPayload | WelcomePayload;

// ─── Ticket confirmation email ────────────────────────────────────────────────

function ticketEmailHtml(p: TicketConfirmationPayload): string {
  const ticketsHtml = p.tickets.map((t, idx) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${t.qrToken}`;
    const qrSource = t.qrCode || qrUrl;
    
    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4faf6;border:1px solid #d0ead9;border-radius:12px;padding:24px;margin-bottom:16px;">
        <tr><td>
          <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1a1a1a;">${p.eventTitle} - Ticket ${idx + 1} of ${p.tickets.length}</p>
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
          
          <div style="margin-top:24px;text-align:center;">
            <img src="${qrSource}" alt="QR Code" width="220" height="220" style="display:block;margin:0 auto;border:4px solid #fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);width:220px;height:220px;"/>
            <p style="margin-top:8px;font-size:11px;color:#888;font-family:monospace;">${t.ticketCode}</p>
          </div>

          <div style="margin-top:20px;text-align:center;">
            <a href="https://tixoraafrica.com.ng/wallet?ticket=${t.ticketCode}" 
               style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 24px;border-radius:10px;">
              Add to Google Wallet
            </a>
          </div>

          <div style="margin-top:16px;text-align:center;border-top:1px solid #eee;padding-top:16px;">
            <p style="margin:0 0 10px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Add to Calendar</p>
            <div style="display:inline-block;">
              <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(p.eventTitle)}&dates=${t.date.replace(/-/g, '')}T${t.time.replace(/:/g, '')}00Z/${t.date.replace(/-/g, '')}T${(parseInt(t.time.split(':')[0] || '00') + 2).toString().padStart(2, '0')}${t.time.split(':')[1] || '00'}00Z&details=${encodeURIComponent(`My ticket for ${p.eventTitle}. Ticket code: ${t.ticketCode}. Powered by Tixora.`)}&location=${encodeURIComponent(`${t.venue}, ${t.city}`)}" 
                 style="color:#1A7A4A;text-decoration:none;font-size:12px;font-weight:600;margin:0 8px;">Google</a>
              <span style="color:#ddd;">|</span>
              <a href="https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(p.eventTitle)}&startdt=${t.date}T${t.time}:00Z&enddt=${t.date}T${(parseInt(t.time.split(':')[0] || '00') + 2).toString().padStart(2, '0')}:${t.time.split(':')[1] || '00'}:00Z&body=${encodeURIComponent(`My ticket for ${p.eventTitle}. Ticket code: ${t.ticketCode}. Powered by Tixora.`)}&location=${encodeURIComponent(`${t.venue}, ${t.city}`)}"
                 style="color:#1A7A4A;text-decoration:none;font-size:12px;font-weight:600;margin:0 8px;">Outlook</a>
              <span style="color:#ddd;">|</span>
              <a href="https://tixoraafrica.com.ng/calendar.ics?title=${encodeURIComponent(p.eventTitle)}&date=${t.date}&time=${t.time}&location=${encodeURIComponent(`${t.venue}, ${t.city}`)}&description=${encodeURIComponent(`My ticket for ${p.eventTitle}. Ticket code: ${t.ticketCode}. Powered by Tixora.`)}"
                 style="color:#1A7A4A;text-decoration:none;font-size:12px;font-weight:600;margin:0 8px;">Apple / ICS</a>
            </div>
          </div>
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

// ─── Welcome email ────────────────────────────────────────────────────────────

function welcomeEmailHtml(p: WelcomePayload): string {
  const firstName = p.buyerName?.split(" ")[0] || "there";
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
          <p style="margin:8px 0 0;color:#a8dfc0;font-size:14px;">Welcome to Africa's event experience</p>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:40px 40px 0;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#1a1a1a;">Welcome, ${firstName}! 🎉</p>
          <p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.7;">
            You're now part of the Tixora community — Nigeria's home for discovering and experiencing the best events.
          </p>
          <p style="margin:12px 0 0;font-size:15px;color:#555;line-height:1.7;">Here's what you can do:</p>
          <ul style="margin:12px 0 0;padding-left:20px;color:#444;font-size:14px;line-height:2.2;">
            <li>🔍 Discover concerts, festivals, workshops and more</li>
            <li>🎟 Buy tickets with ease — pay securely via Paystack</li>
            <li>📅 Create and sell tickets for your own events</li>
            <li>🔄 Transfer or resell tickets if your plans change</li>
          </ul>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:32px 40px 40px;text-align:center;">
          <a href="https://tixoraafrica.com.ng"
            style="display:inline-block;background:#1A7A4A;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 40px;border-radius:10px;letter-spacing:0.2px;">
            Explore Events
          </a>
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

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return errorResponse("RESEND_API_KEY not set", 500);

    const payload = await req.json() as EmailPayload;

    if (!payload.buyerEmail) {
      return errorResponse("Missing required field: buyerEmail");
    }

    let subject: string;
    let html: string;

    if (payload.type === "welcome") {
      const firstName = payload.buyerName?.split(" ")[0] || "there";
      subject = `Welcome to Tixora, ${firstName}!`;
      html = welcomeEmailHtml(payload as WelcomePayload);
    } else {
      // ticket_confirmation (default)
      const p = payload as TicketConfirmationPayload;
      if (!p.eventTitle || !p.tickets) {
        return errorResponse("Missing required fields for ticket_confirmation");
      }
      subject = `Your ticket for ${p.eventTitle} ✓`;
      html = ticketEmailHtml(p);
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Tixora <tickets@tixoraafrica.com.ng>",
        to: [payload.buyerEmail],
        subject,
        html,
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

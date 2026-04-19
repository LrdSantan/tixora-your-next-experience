import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOG = "[send-invoice-email]";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { "Content-Type": "application/json", ...corsHeaders };

const ADMIN_EMAIL = "yusufquadir50@gmail.com";

function errorResponse(msg: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, error: msg }), { status, headers: jsonHeaders });
}

function successResponse(data: unknown): Response {
  return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: jsonHeaders });
}

function formatPrice(amountKobo: number): string {
  return `₦${(amountKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface TierRevenue {
  name: string;
  price: number;
  quantity: number;
  revenue: number;
}

function invoiceEmailHtml(
  eventName: string,
  eventDate: string,
  eventVenue: string,
  organizerName: string,
  invoiceNumber: string,
  tierRevenues: TierRevenue[],
  totalRevenue: number
): string {
  const tableRows = tierRevenues.map(tier => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; color: #333;">${tier.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; text-align: center; color: #333;">${tier.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; text-align: right; color: #333;">${formatPrice(tier.price * 100)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; font-size: 14px; text-align: right; font-weight: 700; color: #1a7a4a;">${formatPrice(tier.revenue)}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Event Revenue Invoice</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f7f5; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #1a7a4a; padding: 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">🎟 TIXORA</h1>
                  </td>
                  <td style="text-align: right;">
                    <span style="color: #ffffff; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 100px;">Revenue Invoice</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Invoice Summary Info -->
          <tr>
            <td style="padding: 40px 40px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: top;">
                    <p style="margin: 0 0 5px; font-size: 12px; color: #888; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Billed To</p>
                    <p style="margin: 0; font-size: 16px; font-weight: 700; color: #1a1a1a;">${organizerName}</p>
                    <p style="margin: 5px 0 0; font-size: 14px; color: #555;">Event Organizer</p>
                  </td>
                  <td style="text-align: right; vertical-align: top;">
                    <p style="margin: 0 0 5px; font-size: 12px; color: #888; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Invoice Details</p>
                    <p style="margin: 0; font-size: 14px; color: #1a1a1a;"><strong>ID:</strong> ${invoiceNumber}</p>
                    <p style="margin: 5px 0 0; font-size: 14px; color: #1a1a1a;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Event Info -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background-color: #f9fbf9; border: 1px solid #e8ede9; border-radius: 12px; padding: 20px;">
                <p style="margin: 0 0 10px; font-size: 13px; color: #1a7a4a; font-weight: 700; text-transform: uppercase;">Event Information</p>
                <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #1a1a1a;">${eventName}</h2>
                <p style="margin: 0; font-size: 14px; color: #555;">${eventDate} · ${eventVenue}</p>
              </div>
            </td>
          </tr>

          <!-- Revenue Table -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #fcfcfc;">
                    <th style="padding: 12px; border-bottom: 2px solid #1a7a4a; text-align: left; font-size: 12px; color: #888; text-transform: uppercase; font-weight: 700;">Ticket Tier</th>
                    <th style="padding: 12px; border-bottom: 2px solid #1a7a4a; text-align: center; font-size: 12px; color: #888; text-transform: uppercase; font-weight: 700;">Qty Sold</th>
                    <th style="padding: 12px; border-bottom: 2px solid #1a7a4a; text-align: right; font-size: 12px; color: #888; text-transform: uppercase; font-weight: 700;">Unit Price</th>
                    <th style="padding: 12px; border-bottom: 2px solid #1a7a4a; text-align: right; font-size: 12px; color: #888; text-transform: uppercase; font-weight: 700;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <table width="280" cellpadding="0" cellspacing="0" style="margin-left: auto;">
                <tr>
                  <td style="padding: 10px 0; font-size: 14px; color: #555;">Gross Subtotal</td>
                  <td style="padding: 10px 0; font-size: 14px; text-align: right; font-weight: 600; color: #1a1a1a;">${formatPrice(totalRevenue)}</td>
                </tr>
                <tr style="border-top: 2px solid #eee;">
                  <td style="padding: 20px 0 10px; font-size: 16px; font-weight: 800; color: #1a1a1a;">Net Revenue</td>
                  <td style="padding: 20px 0 10px; font-size: 22px; font-weight: 900; text-align: right; color: #1a7a4a;">${formatPrice(totalRevenue)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 30px 40px; border-top: 1px solid #eee; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #888; line-height: 1.5;">
                This invoice serves as a summary of revenue collected via Tixora. If you have any questions, please contact our support team.
              </p>
              <div style="margin-top: 20px;">
                <p style="margin: 0; font-size: 12px; color: #aaa; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Powered by Tixora</p>
                <div style="margin-top: 8px;">
                   <a href="https://tixoraafrica.com.ng" style="font-size: 12px; color: #1a7a4a; text-decoration: none; font-weight: 600;">tixoraafrica.com.ng</a>
                </div>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !resendKey) {
      return errorResponse("Server configuration error", 500);
    }

    const { event_id, recipient_email } = await req.json();

    if (!event_id || !recipient_email) {
      return errorResponse("Missing event_id or recipient_email");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing Authorization header", 401);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user || user.email !== ADMIN_EMAIL) {
      console.error(`${LOG} Auth failed`, { email: user?.email, error: authError });
      return errorResponse("Unauthorized: Admin access only", 403);
    }

    // ── 1. Fetch Event and Organizer Data ──────────────────────────────────────
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(`
        title,
        date,
        venue,
        city,
        organizer_email
      `)
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return errorResponse("Event not found", 404);
    }

    // ── 2. Fetch Tier Data and Aggregate Revenue ────────────────────────────────
    const { data: tiers, error: tiersError } = await supabase
      .from("ticket_tiers")
      .select(`
        id,
        name,
        price,
        tickets (
          quantity,
          amount_paid,
          status
        )
      `)
      .eq("event_id", event_id);

    if (tiersError || !tiers) {
      return errorResponse("Could not fetch revenue data", 500);
    }

    let totalRevenue = 0;
    const tierRevenues: TierRevenue[] = tiers.map((tier: any) => {
      const confirmedTickets = (tier.tickets || []).filter((t: any) => t.status === "confirmed");
      const tierQty = confirmedTickets.reduce((sum: number, t: any) => sum + (t.quantity || 1), 0);
      const tierRev = confirmedTickets.reduce((sum: number, t: any) => sum + (t.amount_paid || 0), 0);
      
      totalRevenue += tierRev;
      
      return {
        name: tier.name,
        price: tier.price,
        quantity: tierQty,
        revenue: tierRev
      };
    });

    const organizerName = event.organizer_email?.split("@")[0] || "Event Organizer";
    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${event_id.slice(0, 4).toUpperCase()}`;

    // ── 3. Send Email ─────────────────────────────────────────────────────────
    const emailHtml = invoiceEmailHtml(
      event.title,
      event.date,
      `${event.venue}, ${event.city}`,
      organizerName,
      invoiceNumber,
      tierRevenues,
      totalRevenue
    );

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Tixora Revenue <finance@tixoraafrica.com.ng>",
        to: [recipient_email],
        subject: `Invoice: ${event.title} - Revenue Summary`,
        html: emailHtml,
      }),
    });

    const resendBody = await emailRes.json();
    console.log(`${LOG} Resend response`, resendBody);

    if (!emailRes.ok) {
      return errorResponse(resendBody?.message ?? "Failed to send invoice", 502);
    }

    return successResponse({ success: true, emailId: resendBody.id, invoiceNumber });

  } catch (err) {
    console.error(`${LOG} Fatal Error`, err);
    return errorResponse(err instanceof Error ? err.message : "Unexpected error", 500);
  }
});

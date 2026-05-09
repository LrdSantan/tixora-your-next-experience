import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://tixoraafrica.com.ng";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) throw new Error("Missing env vars");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const { tier_id } = body ?? {};

    if (!tier_id) {
      return json({ error: "tier_id is required" }, 400);
    }

    // Find the next person in the queue
    const { data: entry, error: findError } = await supabase
      .from("waitlist")
      .select("id, event_id, tier_id, guest_name, guest_email, checkout_token")
      .eq("tier_id", tier_id)
      .eq("status", "waiting")
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (findError) throw findError;

    if (!entry) {
      return json({ success: true, notified: false });
    }

    // Generate a checkout token if not already set
    const checkoutToken = entry.checkout_token || crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Update the entry: status → notified, set times and token
    const { error: updateError } = await supabase
      .from("waitlist")
      .update({
        status: "notified",
        notified_at: new Date().toISOString(),
        expires_at: expiresAt,
        checkout_token: checkoutToken,
      })
      .eq("id", entry.id);

    if (updateError) throw updateError;

    // Fetch the event title for the email
    const { data: eventData } = await supabase
      .from("events")
      .select("title")
      .eq("id", entry.event_id)
      .single();

    const eventTitle = eventData?.title ?? "your event";
    const claimUrl = `${SITE_URL}/waitlist-checkout?token=${checkoutToken}&tier=${tier_id}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4faf6; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #1A7A4A 0%, #15a05c 100%); color: #ffffff; padding: 36px 40px; }
          .header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 800; }
          .header p { margin: 0; opacity: 0.85; font-size: 14px; }
          .content { padding: 40px; }
          .highlight-box { background: #fffbeb; border: 2px solid #fbbf24; border-radius: 12px; padding: 20px 24px; margin: 24px 0; }
          .highlight-box p { margin: 0; font-size: 15px; font-weight: 600; color: #92400e; }
          .cta-btn { display: block; text-align: center; background: #1A7A4A; color: #ffffff !important; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; margin: 28px 0; letter-spacing: -0.2px; }
          .expiry-note { font-size: 12px; color: #888; text-align: center; margin-top: -12px; }
          .footer { background: #f9f9f9; padding: 24px 40px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #aaa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎟 TIXORA</h1>
            <p>A spot just opened up for you!</p>
          </div>
          <div class="content">
            <p>Hi <strong>${entry.guest_name}</strong>,</p>
            <p>Great news! A ticket for <strong>${eventTitle}</strong> just became available and you're next on the waitlist.</p>

            <div class="highlight-box">
              <p>⏰ You have <strong>24 hours</strong> to claim your spot before it's offered to the next person.</p>
            </div>

            <p>Click the button below to complete your purchase and secure your ticket:</p>

            <a href="${claimUrl}" class="cta-btn">Claim My Spot →</a>
            <p class="expiry-note">This link expires in 24 hours.</p>

            <p style="color:#666; font-size:14px;">If you no longer want this spot, simply ignore this email and it will be offered to the next person in line.</p>
          </div>
          <div class="footer">
            <p>You received this because you joined the waitlist for <strong>${eventTitle}</strong>.</p>
            <p>&copy; ${new Date().getFullYear()} Tixora Africa</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Tixora <tickets@tixoraafrica.com.ng>",
        to: [entry.guest_email],
        subject: `A spot just opened for ${eventTitle} — claim it now!`,
        html,
      }),
    });

    if (!emailRes.ok) {
      console.error("[notify-next-waitlist] Resend error:", await emailRes.text());
    }

    return json({ success: true, notified: true, guest_email: entry.guest_email });

  } catch (err: any) {
    console.error("[notify-next-waitlist] Fatal error:", err);
    return json({ error: err.message || "Unexpected error" }, 500);
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BlastRequest {
  event_id: string;
  subject: string;
  message: string;
  organizer_id: string;
  channel?: "email" | "sms" | "both";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const termiiApiKey = Deno.env.get("TERMII_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body: BlastRequest = await req.json();
    const { event_id, subject, message, organizer_id, channel = "email" } = body;

    if (!event_id || !subject || !message || !organizer_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Validate organizer owns the event
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, organizer_id")
      .eq("id", event_id)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (event.organizer_id !== organizer_id) {
      return new Response(JSON.stringify({ error: "Unauthorized: You do not own this event" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Fetch recipients
    const { data: tickets, error: ticketsError } = await supabase
      .from("tickets")
      .select("guest_name, guest_email, guest_phone")
      .eq("event_id", event_id)
      .eq("status", "confirmed");

    if (ticketsError) {
      throw ticketsError;
    }

    if (!tickets || tickets.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No confirmed ticket holders found" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Send emails
    const errors: string[] = [];
    let sentCount = 0;
    let smsSentCount = 0;

    for (const ticket of tickets) {
      // 3. Send emails if channel is email or both
      if ((channel === "email" || channel === "both") && ticket.guest_email) {
        try {
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4faf6; }
                .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
                .header { background: #1A7A4A; color: #ffffff; padding: 32px 40px; }
                .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.3px; }
                .event-label { margin-top: 8px; font-size: 14px; opacity: 0.8; }
                .content { padding: 40px; }
                .message-body { font-size: 16px; color: #1a1a1a; white-space: pre-wrap; }
                .footer { background: #f9f9f9; padding: 24px 40px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #aaa; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎟 TIXORA</h1>
                  <div class="event-label">Update regarding: ${event.title}</div>
                </div>
                <div class="content">
                  <p>Hi ${ticket.guest_name || "Attendee"},</p>
                  <div class="message-body">${message}</div>
                </div>
                <div class="footer">
                  <p>You received this because you have a ticket for <strong>${event.title}</strong>.</p>
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
              to: [ticket.guest_email],
              subject: subject,
              html: html,
            }),
          });

          if (emailRes.ok) {
            sentCount++;
          } else {
            errors.push(`Resend error for ${ticket.guest_email}: ${await emailRes.text()}`);
          }
        } catch (err: any) {
          errors.push(`Unexpected error for ${ticket.guest_email}: ${err.message}`);
        }
      }

      // 4. Send SMS via Termii if channel is sms or both and phone is available
      if ((channel === "sms" || channel === "both") && ticket.guest_phone && termiiApiKey) {
        try {
          const smsRes = await fetch("https://v3.api.termii.com/api/sms/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: ticket.guest_phone,
              from: "N-Alert",
              sms: `${subject}\n\n${message}\n\n- Tixora`,
              type: "plain",
              channel: "generic",
              api_key: termiiApiKey,
            }),
          });
          
          if (smsRes.ok) {
            smsSentCount++;
          } else {
            errors.push(`SMS error for ${ticket.guest_phone}: ${await smsRes.text()}`);
          }
        } catch (smsErr: any) {
          errors.push(`SMS error for ${ticket.guest_phone}: ${smsErr.message}`);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount, sms_sent: smsSentCount, errors }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Fatal error in send-guest-blast:", err);
    return new Response(JSON.stringify({ error: err.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

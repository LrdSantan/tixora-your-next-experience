import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const summary = { processed: 0, skipped: 0, errors: [] as string[] };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date();

    // 1. Fetch all events that could have ended recently
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, title, date, time, venue, city")
      .eq("status", "active")
      .lte("date", now.toISOString().split("T")[0]);

    if (eventsError) {
      summary.errors.push(`Error fetching events: ${eventsError.message}`);
      throw eventsError;
    }

    // 2. Filter in JS for events that ended in the last 2 hours
    const eligibleEvents = (events || []).filter(event => {
      const eventDatetime = new Date(`${event.date}T${event.time}:00`);
      const diffMs = now.getTime() - eventDatetime.getTime();
      // Events that ended between 0 and 2 hours ago
      return diffMs >= 0 && diffMs <= 2 * 60 * 60 * 1000;
    });

    for (const event of eligibleEvents) {
      // 3. Check if feedback email already sent
      const { data: log } = await supabase
        .from("event_reminder_logs")
        .select("id")
        .eq("event_id", event.id)
        .eq("reminder_type", "post_event")
        .maybeSingle();

      if (log) {
        summary.skipped++;
        continue;
      }

      // 4. Fetch confirmed ticket holders
      const { data: tickets, error: ticketsError } = await supabase
        .from("tickets")
        .select("id, guest_name, guest_email")
        .eq("event_id", event.id)
        .eq("status", "confirmed");

      if (ticketsError) {
        summary.errors.push(`Error fetching tickets for event ${event.id}: ${ticketsError.message}`);
        continue;
      }

      if (!tickets || tickets.length === 0) {
        summary.skipped++;
        continue;
      }

      // 5. Send emails
      for (const ticket of tickets) {
        if (!ticket.guest_email) continue;

        try {
          const feedbackUrl = `https://tixoraafrica.com.ng/feedback/${event.id}?ticket=${ticket.id}`;
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4faf6; }
                .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
                .header { background: #1A7A4A; color: #ffffff; padding: 32px 40px; text-align: center; }
                .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
                .content { padding: 40px; text-align: center; }
                .cta-button { display: inline-block; background-color: #1A7A4A; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 700; margin: 24px 0; }
                .footer { background: #f9f9f9; padding: 24px 40px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #aaa; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎟 TIXORA</h1>
                  <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px; font-weight: 500;">How was the show?</p>
                </div>
                <div class="content">
                  <p style="font-size: 18px; margin-top: 0; color: #1a1a1a;">Hi <strong>${ticket.guest_name}</strong>,</p>
                  <p style="color: #555;">Thanks for attending <strong>${event.title}</strong>! We'd love to hear what you thought about it. Your feedback helps organizers create even better experiences.</p>
                  
                  <a href="${feedbackUrl}" class="cta-button">Leave Feedback</a>
                  
                  <p style="color: #888; font-size: 14px;">It only takes a minute!</p>
                </div>
                <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} Tixora Africa · Sent to ${ticket.guest_email}.</p>
                </div>
              </div>
            </body>
            </html>
          `;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Tixora <tickets@tixoraafrica.com.ng>",
              to: [ticket.guest_email],
              subject: `How was ${event.title}? Share your feedback`,
              html: html,
            }),
          });
        } catch (e: any) {
          summary.errors.push(`Email error for ${ticket.guest_email}: ${e.message}`);
        }
      }

      // 6. Log success
      await supabase.from("event_reminder_logs").insert({
        event_id: event.id,
        reminder_type: "post_event",
        recipient_count: tickets.length
      });

      summary.processed++;
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Post-event feedback error:", err);
    return new Response(JSON.stringify({ ...summary, fatal_error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

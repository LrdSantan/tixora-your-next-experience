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
      throw new Error("Missing environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or RESEND_API_KEY)");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const now = new Date();

    // Fetch all upcoming active events
    const { data: allEvents, error: allEventsError } = await supabase
      .from("events")
      .select("id, title, date, time, venue, city")
      .eq("status", "active")
      .gte("date", new Date().toISOString().split("T")[0]);

    if (allEventsError) {
      summary.errors.push(`Error fetching events: ${allEventsError.message}`);
    }

    const reminderWindows = [
      {
        type: "24hr",
        minMs: 23 * 60 * 60 * 1000,
        maxMs: 25 * 60 * 60 * 1000,
        subject: (title: string) => `Reminder: ${title} is tomorrow!`,
      },
      {
        type: "1hr",
        minMs: -5 * 60 * 1000,
        maxMs: 65 * 60 * 1000,
        subject: (title: string) => `Reminder: ${title} starts in 1 hour!`,
      }
    ];

    for (const window of reminderWindows) {
      const eligibleEvents = (allEvents || []).filter(event => {
        const eventDatetime = new Date(`${event.date}T${event.time}:00`);
        const diffMs = eventDatetime.getTime() - now.getTime();
        return diffMs >= window.minMs && diffMs <= window.maxMs;
      });

      for (const event of eligibleEvents) {
        // Check if this reminder was already sent
        const { data: log, error: logError } = await supabase
          .from("event_reminder_logs")
          .select("id")
          .eq("event_id", event.id)
          .eq("reminder_type", window.type)
          .maybeSingle();

        if (logError) {
          summary.errors.push(`Error checking logs for event ${event.id}: ${logError.message}`);
          continue;
        }

        if (log) {
          summary.skipped++;
          continue;
        }

        // Fetch all confirmed ticket holders for this event
        const { data: tickets, error: ticketsError } = await supabase
          .from("tickets")
          .select("guest_name, guest_email, ticket_code")
          .eq("event_id", event.id)
          .eq("status", "confirmed");

        if (ticketsError) {
          summary.errors.push(`Error fetching tickets for event ${event.id}: ${ticketsError.message}`);
          continue;
        }

        if (!tickets || tickets.length === 0) {
          // No one to remind, but we should log it so we don't keep checking
          await supabase.from("event_reminder_logs").insert({
            event_id: event.id,
            reminder_type: window.type,
            recipient_count: 0
          });
          summary.skipped++;
          continue;
        }

        // Send reminders to each recipient
        for (const ticket of tickets) {
          if (!ticket.guest_email) continue;

          try {
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
                  .content { padding: 40px; }
                  .detail-card { background: #f9f9f9; border: 1px solid #eee; border-radius: 12px; padding: 24px; margin-bottom: 32px; }
                  .detail-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; border-bottom: 1px solid #f0f0f0; padding-bottom: 12px; }
                  .detail-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
                  .detail-label { color: #888; font-weight: 500; }
                  .detail-value { font-weight: 700; color: #1a1a1a; text-align: right; }
                  .footer { background: #f9f9f9; padding: 24px 40px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #aaa; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🎟 TIXORA</h1>
                    <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px; font-weight: 500;">Event Reminder</p>
                  </div>
                  <div class="content">
                    <p style="font-size: 18px; margin-top: 0; color: #1a1a1a;">Hi <strong>${ticket.guest_name}</strong>,</p>
                    <p style="color: #555;">Don't forget! Your event <strong>${event.title}</strong> is coming up soon. Here are the details:</p>
                    
                    <div class="detail-card">
                      <div class="detail-row">
                        <span class="detail-label">Event</span>
                        <span class="detail-value">${event.title}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Date & Time</span>
                        <span class="detail-value">${new Date(event.date).toLocaleDateString("en-NG", { dateStyle: "long" })} at ${event.time}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Location</span>
                        <span class="detail-value">${event.venue}, ${event.city}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Ticket Code</span>
                        <span class="detail-value" style="font-family: monospace;">${ticket.ticket_code}</span>
                      </div>
                    </div>

                    <p style="text-align: center; font-size: 20px; margin: 32px 0 0;">See you there! 🎉</p>
                  </div>
                  <div class="footer">
                    <p>&copy; ${new Date().getFullYear()} Tixora Africa · This is an automated reminder sent to ${ticket.guest_email}.</p>
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
                subject: window.subject(event.title),
                html: html,
              }),
            });
          } catch (e: any) {
            summary.errors.push(`Email error for ${ticket.guest_email}: ${e.message}`);
          }
        }

        // Insert log to avoid double-sending
        await supabase.from("event_reminder_logs").insert({
          event_id: event.id,
          reminder_type: window.type,
          recipient_count: tickets.length
        });

        summary.processed++;
      }
    }

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Fatal error in send-event-reminders:", err);
    return new Response(JSON.stringify({ ...summary, fatal_error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

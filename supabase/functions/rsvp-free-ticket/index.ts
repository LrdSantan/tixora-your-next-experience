import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RsvpRequest {
  event_id: string;
  tier_id: string;
  name: string;
  email: string;
  phone?: string;
  user_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: RsvpRequest = await req.json();
    const { event_id, tier_id, name, email, phone, user_id: providedUserId } = body;
    const registrationAnswers: { question_id: string; answer: string }[] = (body as any).registration_answers ?? [];

    if (!event_id || !tier_id || !name || !email) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 1. Validate tier exists, belongs to event, and is free
    const { data: tier, error: tierError } = await supabase
      .from("ticket_tiers")
      .select("*, events(*)")
      .eq("id", tier_id)
      .eq("event_id", event_id)
      .single();

    if (tierError || !tier) {
      return new Response(JSON.stringify({ success: false, error: "Tier not found" }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (tier.price > 0) {
      return new Response(JSON.stringify({ success: false, error: "Tier is not free" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 2. Check tier capacity
    const { count, error: countError } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("tier_id", tier_id)
      .neq("status", "cancelled");

    if (countError) throw countError;
    if (count !== null && count >= tier.quantity) {
      return new Response(JSON.stringify({ success: false, error: "This tier is sold out" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 3. Resolve user_id
    let resolvedUserId = providedUserId;
    if (!resolvedUserId) {
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000
      });
      if (listError) throw listError;

      const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (existingUser) {
        resolvedUserId = existingUser.id;
      } else {
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password: crypto.randomUUID(),
          email_confirm: true,
          user_metadata: { full_name: name, is_guest: true }
        });
        if (createError) throw createError;
        resolvedUserId = newUser.user.id;
      }
    }

    // 4. Generate codes
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let codeSuffix = "";
    for (let i = 0; i < 8; i++) {
      codeSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const ticket_code = `TIX-${codeSuffix}`;
    const qr_token = crypto.randomUUID();

    // 5. Insert ticket
    // Note: 'attendee_name' mapped to 'guest_name', 'attendee_email' to 'guest_email', 'payment_reference' to 'reference'
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        event_id,
        tier_id,
        user_id: resolvedUserId,
        ticket_code,
        qr_token,
        guest_name: name,
        guest_email: email,
        guest_phone: phone ?? null,
        status: 'confirmed',
        source: 'rsvp',
        amount_paid: 0,
        reference: `RSVP-${codeSuffix}`
      })
      .select()
      .single();

    if (ticketError) throw ticketError;

    // 5b. Save registration answers if provided
    if (registrationAnswers.length > 0) {
      const answerRows = registrationAnswers
        .filter((a) => a.question_id && a.answer?.trim())
        .map((a) => ({ ticket_id: ticket.id, question_id: a.question_id, answer: a.answer }));
      if (answerRows.length > 0) {
        const { error: ansErr } = await supabase
          .from("registration_answers")
          .upsert(answerRows, { onConflict: "ticket_id,question_id" });
        if (ansErr) console.error("[rsvp-free-ticket] registration_answers save error:", ansErr);
      }
    }

    // 6. Update remaining quantity
    await supabase.rpc("decrement_tier_quantity", { tier_id_input: tier_id });

    // 7. Send confirmation email via Resend
    const event = tier.events;
    const eventDate = new Date(event.date).toLocaleDateString("en-NG", { dateStyle: "long" });
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "EventReservation",
          "reservationNumber": "${ticket_code}",
          "reservationStatus": "http://schema.org/ReservationConfirmed",
          "underName": {
            "@type": "Person",
            "name": "${name}"
          },
          "reservationFor": {
            "@type": "Event",
            "name": "${event.title}",
            "startDate": "${event.date}T${event.time || '00:00'}:00",
            "location": {
              "@type": "Place",
              "name": "${event.venue}",
              "address": "${event.venue}, ${event.city}"
            }
          }
        }
        </script>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f4faf6; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { background: #1A7A4A; color: #ffffff; padding: 32px 40px; text-align: left; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .content { padding: 40px; }
          .detail-card { background: #f9f9f9; border: 1px solid #eee; border-radius: 12px; padding: 24px; margin-bottom: 32px; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; border-bottom: 1px solid #f0f0f0; padding-bottom: 12px; }
          .detail-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
          .detail-label { color: #888; font-weight: 500; }
          .detail-value { font-weight: 700; color: #1a1a1a; text-align: right; }
          .qr-section { text-align: center; margin-top: 8px; padding: 32px; background: #f4faf6; border: 2px dashed #d0ead9; border-radius: 16px; }
          .qr-img { display: block; margin: 0 auto; border: 8px solid #fff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
          .footer { background: #f9f9f9; padding: 24px 40px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #aaa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎟 TIXORA</h1>
            <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px; font-weight: 500;">Your RSVP is confirmed</p>
          </div>
          <div class="content">
            <p style="font-size: 18px; margin-top: 0; color: #1a1a1a;">Hi <strong>${name}</strong>,</p>
            <p style="color: #555;">You're all set! Your free ticket for <strong>${event.title}</strong> is ready. Please keep this email for check-in.</p>
            
            <div class="detail-card">
              <div class="detail-row">
                <span class="detail-label">Event</span>
                <span class="detail-value">${event.title}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date & Time</span>
                <span class="detail-value">${eventDate} at ${event.time}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Location</span>
                <span class="detail-value">${event.venue}, ${event.city}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Ticket Type</span>
                <span class="detail-value">${tier.name}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Ticket Code</span>
                <span class="detail-value" style="font-family: 'Courier New', Courier, monospace;">${ticket_code}</span>
              </div>
            </div>

            <div class="qr-section">
              <img src="${ticket.qr_code || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qr_token}`}" alt="Ticket QR Code" width="200" height="200" class="qr-img" />
              <p style="margin: 16px 0 0; font-size: 12px; color: #1A7A4A; font-weight: 700; font-family: 'Courier New', Courier, monospace;">${ticket_code}</p>
              <p style="margin: 8px 0 0; font-size: 11px; color: #888;">Present this QR code at the entrance</p>
            </div>

            <div style="margin-top:20px;text-align:center;">
              <a href="https://tixoraafrica.com.ng/wallet?ticket=${ticket_code}" 
                 style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 24px;border-radius:10px;">
                Add to Google Wallet
              </a>
            </div>

            <div style="margin-top:16px;text-align:center;border-top:1px solid #eee;padding-top:16px;">
              <p style="margin:0 0 10px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Add to Calendar</p>
              <div style="display:inline-block;">
                <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${event.date.replace(/-/g, '')}T${(event.time || '00:00').replace(/:/g, '')}00Z/${event.date.replace(/-/g, '')}T${(parseInt((event.time || '00:00').split(':')[0]) + 2).toString().padStart(2, '0')}${(event.time || '00:00').split(':')[1]}00Z&details=${encodeURIComponent(`My ticket for ${event.title}. Ticket code: ${ticket_code}. Powered by Tixora.`)}&location=${encodeURIComponent(`${event.venue}, ${event.city}`)}" 
                   style="color:#1A7A4A;text-decoration:none;font-size:12px;font-weight:600;margin:0 8px;">Google</a>
                <span style="color:#ddd;">|</span>
                <a href="https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&startdt=${event.date}T${event.time || '00:00'}:00Z&enddt=${event.date}T${(parseInt((event.time || '00:00').split(':')[0]) + 2).toString().padStart(2, '0')}:${(event.time || '00:00').split(':')[1]}:00Z&body=${encodeURIComponent(`My ticket for ${event.title}. Ticket code: ${ticket_code}. Powered by Tixora.`)}&location=${encodeURIComponent(`${event.venue}, ${event.city}`)}"
                   style="color:#1A7A4A;text-decoration:none;font-size:12px;font-weight:600;margin:0 8px;">Outlook</a>
                <span style="color:#ddd;">|</span>
                <a href="https://tixoraafrica.com.ng/calendar.ics?title=${encodeURIComponent(event.title)}&date=${event.date}&time=${event.time || '00:00'}&location=${encodeURIComponent(`${event.venue}, ${event.city}`)}&description=${encodeURIComponent(`My ticket for ${event.title}. Ticket code: ${ticket_code}. Powered by Tixora.`)}"
                   style="color:#1A7A4A;text-decoration:none;font-size:12px;font-weight:600;margin:0 8px;">Apple / ICS</a>
              </div>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Tixora Africa · This is an automated email sent to ${email}.</p>
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
        to: [email],
        subject: `Your RSVP is confirmed — ${event.title}`,
        html: emailHtml,
      }),
    });

    if (!emailRes.ok) {
      console.error("Resend error:", await emailRes.text());
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        ticket_code, 
        qr_token, 
        ticket_id: ticket.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Fatal error in rsvp-free-ticket:", err);
    return new Response(JSON.stringify({ success: false, error: err.message || "Unexpected error" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as jose from "https://esm.sh/jose@5.2.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ticket_id } = await req.json();
    if (!ticket_id) throw new Error("ticket_id is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch ticket with event and tier details
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .select(`
        id,
        ticket_code,
        qr_token,
        guest_name,
        guest_email,
        events (
          id,
          title,
          date,
          time,
          venue,
          city,
          cover_image_url
        ),
        ticket_tiers (
          name
        )
      `)
      .eq("id", ticket_id)
      .single();

    if (ticketError || !ticket) {
      console.error("[GoogleWallet] Error fetching ticket:", ticketError);
      throw new Error("Ticket not found");
    }

    const issuerId = Deno.env.get("GOOGLE_WALLET_ISSUER_ID");
    const serviceAccountEmail = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL");
    const privateKeyStr = Deno.env.get("GOOGLE_WALLET_PRIVATE_KEY")?.replace(/\\n/g, '\n');

    if (!issuerId || !serviceAccountEmail || !privateKeyStr) {
      throw new Error("Missing Google Wallet environment variables");
    }

    const event = ticket.events;
    const tier = ticket.ticket_tiers;
    const classId = `${issuerId}.${event.id}`;
    const objectId = `${issuerId}.${ticket.ticket_code}`;

    // Construct the Event Ticket Class
    const eventTicketClass = {
      id: classId,
      issuerName: "Tixora",
      reviewStatus: "UNDER_REVIEW",
      eventName: {
        defaultValue: { language: "en-US", value: event.title }
      },
      venue: {
        name: { defaultValue: { language: "en-US", value: event.venue } },
        address: { defaultValue: { language: "en-US", value: `${event.venue}, ${event.city}` } },
      },
      dateTime: event.date ? `${event.date}T${event.time || '00:00'}:00` : undefined,
      heroImage: event.cover_image_url ? {
        sourceUri: { uri: event.cover_image_url },
      } : undefined,
      hexBackgroundColor: "#1A7A4A",
      logo: {
        sourceUri: { uri: "https://tixoraafrica.com.ng/tixora-logo.png" },
      },
    };

    // Construct the Event Ticket Object
    const eventTicketObject = {
      id: objectId,
      classId: classId,
      state: "ACTIVE",
      barcode: {
        type: "QR_CODE",
        value: ticket.qr_token,
      },
      ticketHolderName: ticket.guest_name,
      ticketType: {
        defaultValue: { language: "en-US", value: tier?.name || "Regular" }
      },
    };

    // Prepare JWT payload
    const payload = {
      iss: serviceAccountEmail,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      payload: {
        eventTicketClasses: [eventTicketClass],
        eventTicketObjects: [eventTicketObject],
      },
      origins: [],
    };

    // Sign JWT using RS256
    const privateKey = await jose.importPKCS8(privateKeyStr, "RS256");
    const jwt = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "RS256" })
      .sign(privateKey);

    return new Response(JSON.stringify({ 
      success: true, 
      wallet_url: `https://pay.google.com/gp/v/save/${jwt}` 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[GoogleWallet] Error:", err);
    return new Response(JSON.stringify({ 
      success: false, 
      error: err.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

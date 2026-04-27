import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOG = "[post-purchase-guest-setup]";

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

function claimAccountEmailHtml(p: {
  guestName: string;
  eventTitle: string;
  setPasswordUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4faf6;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <tr><td style="background:#1A7A4A;padding:32px 40px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">🎟 TIXORA</p>
          <p style="margin:8px 0 0;color:#a8dfc0;font-size:14px;">Your ticket is confirmed — and your account is ready</p>
        </td></tr>
        <tr><td style="padding:32px 40px 0;">
          <p style="margin:0;font-size:16px;color:#1a1a1a;">Hi <strong>${p.guestName}</strong>,</p>
          <p style="margin:16px 0 0;font-size:15px;color:#555;line-height:1.6;">
            Your ticket for <strong>${p.eventTitle}</strong> is on its way to your inbox!
          </p>
          <p style="margin:12px 0 0;font-size:15px;color:#555;line-height:1.6;">
            We've created a Tixora account for you using this email address. Set a password to unlock:
          </p>
        </td></tr>
        <tr><td style="padding:24px 40px;">
          <ul style="margin:0;padding-left:20px;color:#444;font-size:14px;line-height:2;">
            <li>View all your tickets in one place</li>
            <li>Download PDF tickets anytime</li>
            <li>Resell or transfer tickets to friends</li>
            <li>Get early access to new events</li>
          </ul>
        </td></tr>
        <tr><td style="padding:0 40px 40px;text-align:center;">
          <a href="${p.setPasswordUrl}"
            style="display:inline-block;background:#1A7A4A;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">
            Set my password
          </a>
          <p style="margin:16px 0 0;font-size:12px;color:#aaa;">
            This link expires in 24 hours. If you didn't buy a ticket, you can safely ignore this email.
          </p>
        </td></tr>
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !resendKey) {
      const missing = [
        !supabaseUrl && "SUPABASE_URL",
        !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
        !resendKey && "RESEND_API_KEY",
      ].filter(Boolean);
      console.error(`${LOG} Missing env vars: ${missing.join(", ")}`);
      return errorResponse("Server misconfigured", 500);
    }

    // Only accept internal calls — verify Authorization header is present
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json() as {
      guestEmail: string;
      guestName?: string;
      eventTitle?: string;
      ticketIds?: string[];
    };

    const guestEmail = body.guestEmail?.trim().toLowerCase();
    const guestName = body.guestName?.trim() || guestEmail?.split("@")[0] || "Guest";
    const eventTitle = body.eventTitle || "Your Event";
    const ticketIds: string[] = body.ticketIds ?? [];

    if (!guestEmail) {
      return errorResponse("guestEmail is required", 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let existingUserId: string | null = null;

    const { data: listData, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error(`${LOG} listUsers error`, listError);
    } else {
      const found = listData?.users?.find(
        (u) => u.email?.toLowerCase() === guestEmail,
      );
      if (found) {
        existingUserId = found.id;
        console.error(`${LOG} Existing user found: ${existingUserId}`);
      }
    }

    let newAccountCreated = false;
    let userId = existingUserId;

    if (!existingUserId) {
      const { data: createData, error: createError } = await admin.auth.admin.createUser({
        email: guestEmail,
        email_confirm: true,
        user_metadata: { full_name: guestName },
      });

      if (createError) {
        if (createError.message?.includes("already been registered") ||
          createError.message?.includes("already exists")) {
          console.error(`${LOG} createUser race: user already exists for ${guestEmail}`);
        } else {
          console.error(`${LOG} createUser failed`, createError);
          return errorResponse(`Could not create guest account: ${createError.message}`, 500);
        }
      } else if (createData?.user) {
        userId = createData.user.id;
        newAccountCreated = true;
        console.error(`${LOG} Created guest account: userId=${userId}`);
      }
    }

    if (userId && ticketIds.length > 0) {
      const { error: linkError } = await admin
        .from("tickets")
        .update({ user_id: userId })
        .in("id", ticketIds)
        .is("user_id", null);

      if (linkError) {
        console.error(`${LOG} Failed to link tickets to userId=${userId}`, linkError);
      } else {
        console.error(`${LOG} Linked ${ticketIds.length} ticket(s) to userId=${userId}`);
      }
    }

    if (newAccountCreated && userId) {
      try {
        const { data: linkData, error: linkGenError } = await admin.auth.admin.generateLink({
          type: "recovery",
          email: guestEmail,
        });

        if (linkGenError || !linkData?.properties?.hashed_token) {
          console.error(`${LOG} generateLink failed`, linkGenError);
        } else {
          const tokenHash = linkData.properties.hashed_token;
          const setPasswordUrl = `https://tixoraafrica.com.ng/set-password?token_hash=${tokenHash}&type=recovery`;

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Tixora <tickets@tixoraafrica.com.ng>",
              to: [guestEmail],
              subject: `Your Tixora ticket is confirmed — claim your account`,
              html: claimAccountEmailHtml({ guestName, eventTitle, setPasswordUrl }),
            }),
          });

          const resendBody = await emailRes.json();
          if (!emailRes.ok) {
            console.error(`${LOG} Resend error`, resendBody);
          } else {
            console.error(`${LOG} Claim email sent: id=${resendBody.id}`);
          }
        }
      } catch (emailErr) {
        console.error(`${LOG} Error generating claim email`, emailErr);
      }
    }

    return successResponse({
      accountCreated: newAccountCreated,
      userId,
      ticketsLinked: ticketIds.length,
    });
  } catch (err) {
    console.error(`${LOG} Fatal error`, err);
    return errorResponse(err instanceof Error ? err.message : "Unexpected error", 500);
  }
});
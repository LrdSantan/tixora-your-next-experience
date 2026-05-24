import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

        // ✅ Verify JWT — admin only
        const authHeader = req.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const jwt = authHeader.replace("Bearer ", "");
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

        if (authError || !user || user.email !== "yusufquadir50@gmail.com") {
            return new Response(JSON.stringify({ error: "Unauthorized: Admin only" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const body = await req.json();
        const { action, subject, message, recipients } = body;

        // ── ACTION: list_users — return all registered emails ──────────────
        if (action === "list_users") {
            const emails: string[] = [];
            let page = 1;
            const perPage = 1000;

            // Paginate through all users via admin API
            while (true) {
                const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
                    page,
                    perPage,
                });
                if (listError) throw listError;
                if (!users || users.length === 0) break;

                for (const u of users) {
                    if (u.email) emails.push(u.email.trim());
                }

                if (users.length < perPage) break;
                page++;
            }

            const unique = Array.from(new Set(emails));
            return new Response(JSON.stringify({ emails: unique }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // ── ACTION: send blast ─────────────────────────────────────────────
        if (!subject || !message || !recipients || recipients.length === 0) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const errors: string[] = [];
        let sentCount = 0;

        for (const email of recipients) {
            if (!email || !email.includes("@")) continue;

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
              .content { padding: 40px; }
              .message-body { font-size: 16px; color: #1a1a1a; white-space: pre-wrap; line-height: 1.8; }
              .footer { background: #f9f9f9; padding: 24px 40px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #aaa; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎟 TIXORA</h1>
              </div>
              <div class="content">
                <div class="message-body">${message}</div>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} Tixora Africa · You're receiving this from the Tixora team.</p>
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
                        from: "Team Tixora <hello@tixoraafrica.com.ng>",
                        to: [email.trim()],
                        subject,
                        html,
                    }),
                });

                if (emailRes.ok) {
                    sentCount++;
                } else {
                    errors.push(`Failed for ${email}: ${await emailRes.text()}`);
                }
            } catch (err: any) {
                errors.push(`Error for ${email}: ${err.message}`);
            }
        }

        return new Response(JSON.stringify({ success: true, sent: sentCount, errors }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Unexpected error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
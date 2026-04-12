import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Ticket, Mail, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

function isEmailNotConfirmedError(error: { message?: string; code?: string }): boolean {
  const m = (error.message ?? "").toLowerCase();
  const c = (error.code ?? "").toLowerCase();
  return (
    c === "email_not_confirmed" ||
    m.includes("email not confirmed") ||
    m.includes("not confirmed")
  );
}

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | undefined)?.from;
  const redirectTo = typeof from === "string" && from.startsWith("/") ? from : "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);

  const redirectOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }
    setShowResendConfirmation(false);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (error) {
      if (isEmailNotConfirmedError(error)) {
        setShowResendConfirmation(true);
        toast.error("Confirm your email first", {
          description: "Open the link we sent you, or resend the confirmation email below.",
        });
        return;
      }
      toast.error(error.message);
      return;
    }
    toast.success("Signed in");
    navigate(redirectTo, { replace: true });
  };

  const handleResendConfirmation = async () => {
    const supabase = getSupabaseClient();
    const addr = email.trim();
    if (!supabase || !addr) {
      toast.error("Enter your email above, then tap Resend.");
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: addr,
      options: { emailRedirectTo: `${redirectOrigin}/` },
    });
    setResending(false);
    if (error) toast.error(error.message);
    else
      toast.success("Confirmation email sent", {
        description: "Check inbox and spam. Site URL in Supabase must match this app (e.g. http://localhost:8080).",
      });
  };

  const handleGoogle = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) toast.error(error.message);
  };

  const handleForgot = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("Supabase is not configured.");
      return;
    }
    const addr = email.trim() || window.prompt("Enter your email for the reset link");
    if (!addr) return;
    const { error } = await supabase.auth.resetPasswordForEmail(addr, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) toast.error(error.message);
    else
      toast.success("Password reset email sent", {
        description: "Check inbox and spam. Redirect URL must be allowed in Supabase (same origin as this app).",
      });
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-hero text-primary-foreground flex-col justify-center items-center p-12">
        <Ticket className="w-16 h-16 mb-4 rotate-[-30deg]" />
        <h1 className="text-4xl font-extrabold mb-2">TIXORA</h1>
        <p className="text-primary-foreground/70 text-center max-w-sm">
          Sign in to access your tickets, manage bookings, and discover amazing events.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Ticket className="w-8 h-8 text-primary rotate-[-30deg]" />
              <span className="text-2xl font-extrabold text-primary">TIXORA</span>
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to your account</p>
            {!isSupabaseConfigured && (
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                Set <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
                <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> in <code className="font-mono">.env.local</code>.
              </p>
            )}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-foreground">Password</label>
                <a href="#" onClick={handleForgot} className="text-xs text-primary hover:underline">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full pl-10 pr-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                />
              </div>
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground h-11 font-semibold">
              {submitting ? "Signing in…" : "Sign In"}
            </Button>
          </form>

          {showResendConfirmation && (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-2">
              <p className="text-sm text-foreground font-medium">Email not confirmed yet</p>
              <p className="text-xs text-muted-foreground">
                Use the link in your email, or resend. Your Vite dev server uses port <span className="font-mono">8080</span> — add{" "}
                <span className="font-mono">http://localhost:8080</span> to Supabase Redirect URLs if you have not.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={resending}
                onClick={() => void handleResendConfirmation()}
              >
                {resending ? "Sending…" : "Resend confirmation email"}
              </Button>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button type="button" variant="outline" className="w-full border-border h-11" onClick={handleGoogle}>
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

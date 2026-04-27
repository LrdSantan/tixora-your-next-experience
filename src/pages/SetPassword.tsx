import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Lock, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase";

const SetPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [exchanged, setExchanged] = useState(false);
  const [exchangeError, setExchangeError] = useState("");

  // Exchange the recovery token on mount so the user is signed in
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tokenHash = params.get("token_hash");
    const type = (params.get("type") as "recovery" | null) ?? "recovery";

    if (!tokenHash) {
      setExchangeError("Invalid or missing token. Please use the link from your email.");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setExchangeError("App is not configured correctly.");
      return;
    }

    // Exchange the token to establish a session
    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type })
      .then(({ error }) => {
        if (error) {
          console.error("[SetPassword] verifyOtp error", error);
          setExchangeError(
            error.message?.includes("expired")
              ? "This link has expired. Please request a new one."
              : error.message ?? "Invalid or expired link.",
          );
        } else {
          setExchanged(true);
        }
      });
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error("App is not configured correctly.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      toast.error(error.message ?? "Could not update password. Please try again.");
      return;
    }

    toast.success("Welcome to Tixora! Your account is ready.");
    navigate("/my-tickets", { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-hero text-primary-foreground flex-col justify-center items-center p-12">
        <Ticket className="w-16 h-16 mb-4 rotate-[-30deg]" />
        <h1 className="text-4xl font-extrabold mb-2">TIXORA</h1>
        <p className="text-primary-foreground/70 text-center max-w-sm">
          One last step — set a password to unlock your full Tixora account.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Ticket className="w-8 h-8 text-primary rotate-[-30deg]" />
              <span className="text-2xl font-extrabold text-primary">TIXORA</span>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">Set your password</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose a password to activate your account and access your tickets.
            </p>
          </div>

          {/* Error state: invalid / expired token */}
          {exchangeError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive space-y-2">
              <p className="font-medium">Unable to verify your link</p>
              <p className="text-muted-foreground">{exchangeError}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={() => navigate("/login")}
              >
                Back to sign in
              </Button>
            </div>
          )}

          {/* Loading while token exchanges */}
          {!exchangeError && !exchanged && (
            <div className="py-8 text-center text-muted-foreground text-sm animate-pulse">
              Verifying your link…
            </div>
          )}

          {/* Password form — only shown after successful token exchange */}
          {exchanged && (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">New password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="set-password-new"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="set-password-confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>
              </div>

              <Button
                id="set-password-submit"
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-primary-foreground h-11 font-semibold"
              >
                {submitting ? "Saving…" : "Set password & go to my tickets"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetPasswordPage;

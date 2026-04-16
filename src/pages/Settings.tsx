import { Settings as SettingsIcon, UserCircle, Landmark, ShieldCheck, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BankSettings } from "@/components/BankSettings";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-8 animate-pulse">
        <div className="flex justify-between items-center">
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid md:grid-cols-[250px_1fr] gap-8">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <SettingsIcon className="mx-auto mb-4 h-16 w-16 text-muted-foreground opacity-20" />
        <h1 className="mb-2 text-2xl font-bold">Please sign in to access settings</h1>
        <p className="text-muted-foreground">You need to be logged in to manage your bank details and preferences.</p>
        <Link to="/login" className="mt-6 inline-block">
          <button className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium">Sign In</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-foreground flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-primary" />
          Account Settings
        </h1>
        <p className="text-muted-foreground mt-2">Manage your personal information and payout preferences.</p>
      </div>

      <div className="grid md:grid-cols-[250px_1fr] gap-8 items-start">
        {/* Sidebar Nav */}
        <aside className="space-y-1">
          <Link
            to="/settings"
            className="flex items-center justify-between p-3 rounded-xl bg-primary/5 text-primary border border-primary/10 transition-all font-medium"
          >
            <div className="flex items-center gap-2.5">
              <Landmark className="w-5 h-5" />
              <span>Payouts & Bank</span>
            </div>
            <ChevronRight className="w-4 h-4 opacity-50" />
          </Link>
          
          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted text-muted-foreground transition-all cursor-not-allowed group">
            <div className="flex items-center gap-2.5">
              <UserCircle className="w-5 h-5 opacity-70 group-hover:opacity-100" />
              <span>Personal Info</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold bg-muted-foreground/10 px-1.5 py-0.5 rounded opacity-60">Soon</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted text-muted-foreground transition-all cursor-not-allowed group">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 opacity-70 group-hover:opacity-100" />
              <span>Security</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold bg-muted-foreground/10 px-1.5 py-0.5 rounded opacity-60">Soon</span>
          </div>
        </aside>

        {/* Content Area */}
        <div className="space-y-12">
          <BankSettings />
          
          <div className="rounded-2xl border border-border p-6 bg-muted/30">
            <h3 className="font-bold text-foreground mb-1">Account Visibility</h3>
            <p className="text-sm text-muted-foreground mb-4">Your email is visible to event organizers when you scan tickets or request transfers.</p>
            <div className="flex items-center gap-2 p-3 bg-card border border-border rounded-xl">
              <UserCircle className="w-5 h-5 text-muted-foreground" />
              <div className="text-sm font-medium truncate">{user.email}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

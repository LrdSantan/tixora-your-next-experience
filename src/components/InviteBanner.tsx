import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, X, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { getSupabaseClient } from "@/lib/supabase";

type PendingInvite = {
  id: string;
  organizer_id: string;
  email: string;
  status: string;
};

export function InviteBanner() {
  const { user, loading } = useAuth();
  const supabase = getSupabaseClient();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [responding, setResponding] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user?.email) return;

    async function fetchInvites() {
      if (!supabase) return;
      const { data } = await supabase
        .from("organizer_team_members")
        .select("id, organizer_id, email, status")
        .eq("email", user!.email!)
        .eq("status", "pending");
      if (data) setInvites(data);
    }

    fetchInvites();
  }, [user, loading, supabase]);

  const respond = async (invite: PendingInvite, action: "accepted" | "declined") => {
    if (!supabase || !user) return;
    setResponding(invite.id);
    try {
      if (action === "accepted") {
        // Update status to accepted and set member_id
        const { error } = await supabase
          .from("organizer_team_members")
          .update({ status: "accepted", member_id: user.id })
          .eq("id", invite.id);
        if (error) throw error;
        toast.success("You've joined the team! You can now scan tickets for their events.");
      } else {
        // Delete the invite on decline
        const { error } = await supabase
          .from("organizer_team_members")
          .delete()
          .eq("id", invite.id);
        if (error) throw error;
        toast.info("Invitation declined.");
      }
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to respond to invite");
    } finally {
      setResponding(null);
    }
  };

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
  };

  const visible = invites.filter((i) => !dismissed.has(i.id));
  if (!visible.length) return null;

  return (
    <div className="z-40 w-full space-y-2 px-4 pt-3">
      {visible.map((invite) => (
        <div
          key={invite.id}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">Team invitation:</span> You've been invited to join an organizer's team to help scan tickets.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              className="bg-primary text-primary-foreground gap-1 h-8"
              disabled={responding === invite.id}
              onClick={() => respond(invite, "accepted")}
            >
              <Check className="w-3.5 h-3.5" /> Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 h-8 text-muted-foreground"
              disabled={responding === invite.id}
              onClick={() => respond(invite, "declined")}
            >
              Decline
            </Button>
            <button
              type="button"
              onClick={() => dismiss(invite.id)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

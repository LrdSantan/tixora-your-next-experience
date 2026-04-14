import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, Mail, Loader2, Check, Clock, Trash2, ShieldX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { getSupabaseClient } from "@/lib/supabase";

type TeamMember = {
  id: string;
  organizer_id: string;
  member_id: string | null;
  email: string;
  status: "pending" | "accepted";
  created_at: string;
};

const ADMIN_EMAIL = "yusufquadir50@gmail.com";

export default function OrganizerTeamPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const supabase = getSupabaseClient();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?redirect=/organizer/team");
  }, [user, authLoading, navigate]);

  async function loadMembers() {
    if (!supabase || !user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("organizer_team_members")
        .select("*")
        .eq("organizer_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setMembers(data ?? []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load team");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (user && !authLoading) loadMembers();
  }, [user, authLoading]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !supabase || !user) return;
    if (email === user.email) {
      toast.error("You can't invite yourself");
      return;
    }
    setInviting(true);
    try {
      // Try to resolve member_id from auth.users via a lightweight profiles check
      // We insert with email; member_id will be resolved on accept
      const { error } = await supabase.from("organizer_team_members").insert({
        organizer_id: user.id,
        email,
        status: "pending",
      });
      if (error) {
        if (error.code === "23505") {
          toast.error("This person has already been invited");
        } else {
          throw error;
        }
        return;
      }
      toast.success(`Invite sent to ${email}`);
      setInviteEmail("");
      loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (id: string, email: string) => {
    if (!supabase) return;
    if (!window.confirm(`Remove ${email} from your team?`)) return;
    const { error } = await supabase.from("organizer_team_members").delete().eq("id", id);
    if (error) toast.error("Failed to remove member");
    else {
      toast.success("Member removed");
      loadMembers();
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          My Team
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invite team members to help scan tickets at your events.
        </p>
      </div>

      {/* Invite Form */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-8">
        <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          Invite Member
        </h2>
        <form onSubmit={handleInvite} className="flex gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              placeholder="team@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>
          <Button type="submit" disabled={inviting || !inviteEmail.trim()} className="bg-primary text-primary-foreground shrink-0">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Invite"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          The invited user will see a banner when they log in and can accept or decline.
        </p>
      </div>

      {/* Members List */}
      <div>
        <h2 className="font-semibold text-foreground mb-4">Team Members</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
            <Users className="w-10 h-10 text-primary mx-auto mb-3 opacity-60" />
            <h3 className="font-semibold text-foreground mb-1">No team members yet</h3>
            <p className="text-sm text-muted-foreground">Invite someone above to get started.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{m.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Invited {new Date(m.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {m.status === "accepted" ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                      <Check className="w-3 h-3" /> Accepted
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
                      <Clock className="w-3 h-3" /> Pending
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeMember(m.id, m.email)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Permissions note */}
      <div className="mt-6 rounded-xl bg-muted/40 border border-border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1 flex items-center gap-1.5">
          <ShieldX className="w-4 h-4 text-primary" /> Team member permissions
        </p>
        <ul className="space-y-1 list-disc list-inside mt-2">
          <li>✅ Scan &amp; verify tickets at your events</li>
          <li>✅ View your coupons (read-only)</li>
          <li>❌ Cannot create events or access admin dashboard</li>
          <li>❌ Cannot create or delete coupons</li>
        </ul>
      </div>
    </div>
  );
}

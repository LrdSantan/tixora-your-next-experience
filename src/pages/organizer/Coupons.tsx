import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, ToggleLeft, ToggleRight, Tag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { getSupabaseClient } from "@/lib/supabase";
import { formatPrice } from "@/lib/mock-data";

type OrganizerEvent = {
  id: string;
  title: string;
};

type Coupon = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  event_id: string | null;
  organizer_id: string;
  created_at: string;
  events?: { title: string } | null;
};

const ADMIN_EMAIL = "yusufquadir50@gmail.com";

export default function OrganizerCouponsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const supabase = getSupabaseClient();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [myEvents, setMyEvents] = useState<OrganizerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const [form, setForm] = useState({
    code: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    max_uses: "",
    expires_at: "",
    event_id: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?redirect=/organizer/coupons");
  }, [user, authLoading, navigate]);

  async function loadData() {
    if (!supabase || !user) return;
    setIsLoading(true);
    try {
      // Load organizer's events
      const { data: evData } = await supabase
        .from("events")
        .select("id, title")
        .eq("organizer_id", user.id)
        .order("created_at", { ascending: false });
      setMyEvents(evData ?? []);

      // Load organizer's coupons
      const { data: cpData, error } = await supabase
        .from("coupons")
        .select("*, events(title)")
        .eq("organizer_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCoupons(cpData ?? []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (user && !authLoading) loadData();
  }, [user, authLoading]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;
    if (!form.code.trim() || !form.discount_value) {
      toast.error("Code and value are required");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("coupons").insert({
        code: form.code.trim().toUpperCase(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        max_uses: form.max_uses ? parseInt(form.max_uses) : null,
        expires_at: form.expires_at || null,
        event_id: form.event_id || null,
        organizer_id: user.id,
        is_active: true,
      });
      if (error) throw error;
      toast.success("Coupon created!");
      setCreateOpen(false);
      setForm({ code: "", discount_type: "percentage", discount_value: "", max_uses: "", expires_at: "", event_id: "" });
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create coupon");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCoupon = async (id: string, current: boolean) => {
    if (!supabase) return;
    const { error } = await supabase.from("coupons").update({ is_active: !current }).eq("id", id);
    if (error) toast.error("Failed to toggle coupon");
    else loadData();
  };

  const deleteCoupon = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm("Delete this coupon?")) return;
    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) toast.error("Failed to delete coupon");
    else {
      toast.success("Coupon deleted");
      loadData();
    }
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Tag className="w-6 h-6 text-primary" />
            My Coupons
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage discount codes for your events.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground gap-2">
              <Plus className="w-4 h-4" /> Create Coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Coupon</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Code</label>
                <Input
                  required
                  placeholder="e.g. SUMMER20"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Discount Type</label>
                <Select
                  value={form.discount_type}
                  onValueChange={(v: any) => setForm({ ...form, discount_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount (₦)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Discount Value</label>
                <Input
                  required
                  type="number"
                  min="1"
                  placeholder={form.discount_type === "percentage" ? "e.g. 20" : "e.g. 500"}
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Max Uses (blank = unlimited)</label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Leave blank for unlimited"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Expiry Date (optional)</label>
                <Input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Apply to Event (optional)</label>
                <Select
                  value={form.event_id || "__global__"}
                  onValueChange={(v) => setForm({ ...form, event_id: v === "__global__" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Global coupon (all events)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">Global (applies to all events)</SelectItem>
                    {myEvents.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>{ev.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">If an event is selected, this coupon only applies when that event is in cart.</p>
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : "Create Coupon"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Coupons List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      ) : coupons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
          <Tag className="w-12 h-12 text-primary mx-auto mb-4 opacity-60" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No coupons yet</h3>
          <p className="text-sm text-muted-foreground mb-6">Create your first discount code.</p>
          <Button onClick={() => setCreateOpen(true)} className="bg-primary text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" /> Create Coupon
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-4">Code</th>
                  <th className="px-4 py-4">Discount</th>
                  <th className="px-4 py-4">Event</th>
                  <th className="px-4 py-4">Uses</th>
                  <th className="px-4 py-4">Expiry</th>
                  <th className="px-4 py-4 text-center">Active</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {coupons.map((c) => (
                  <tr key={c.id} className={!c.is_active ? "bg-muted/20 text-muted-foreground" : "hover:bg-muted/10"}>
                    <td className="px-4 py-4">
                      <span className="font-bold font-mono text-foreground">{c.code}</span>
                    </td>
                    <td className="px-4 py-4 font-medium">
                      {c.discount_type === "percentage" ? `${c.discount_value}%` : formatPrice(c.discount_value)}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {c.events?.title ? (
                        <Badge variant="outline" className="font-normal text-xs">{c.events.title}</Badge>
                      ) : (
                        <span className="text-xs italic">Global</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : " (∞)"}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Switch checked={c.is_active} onCheckedChange={() => toggleCoupon(c.id, c.is_active)} />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive h-8 w-8"
                        onClick={() => deleteCoupon(c.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

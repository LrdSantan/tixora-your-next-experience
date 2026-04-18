import { useEffect, useState } from "react";
import { Plus, Trash2, Tag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { getSupabaseClient } from "@/lib/supabase";
import { formatPrice } from "@/lib/mock-data";
import { useAuth } from "@/contexts/auth-context";

type Coupon = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  event_id: string;
  created_by: string;
  created_at: string;
};

export function OrganizerCouponsModal({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const [open, setOpen] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const [form, setForm] = useState({
    code: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    max_uses: "",
    expires_at: "",
  });
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    if (!supabase || !user) return;
    setIsLoading(true);
    try {
      const { data: cpData, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setCoupons(cpData ?? []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load coupons");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (open && user) {
      loadData();
    }
  }, [open, user]);

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
        event_id: eventId,
        created_by: user.id,
        is_active: true,
      });
      if (error) throw error;
      toast.success("Coupon created!");
      setCreateOpen(false);
      setForm({ code: "", discount_type: "percentage", discount_value: "", max_uses: "", expires_at: "" });
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3 border-border hover:bg-muted" title="Manage Coupons">
          <Tag className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Coupons: {eventTitle}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex justify-end">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary text-primary-foreground gap-2">
                  <Plus className="w-4 h-4" /> Create Coupon
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Coupon for {eventTitle}</DialogTitle>
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
                  <Button type="submit" className="w-full bg-primary text-primary-foreground" disabled={submitting}>
                    {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</> : "Create Coupon"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
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
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center flex flex-col items-center">
              <Tag className="w-10 h-10 text-primary mx-auto mb-3 opacity-60" />
              <h3 className="text-base font-semibold text-foreground mb-1">No coupons</h3>
              <p className="text-sm text-muted-foreground">Create discount codes specific to this event.</p>
            </div>
          ) : (
            <div className="bg-card rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3">Code</th>
                      <th className="px-4 py-3">Discount</th>
                      <th className="px-4 py-3">Uses</th>
                      <th className="px-4 py-3">Expiry</th>
                      <th className="px-4 py-3 text-center">Active</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {coupons.map((c) => (
                      <tr key={c.id} className={!c.is_active ? "bg-muted/20 text-muted-foreground" : "hover:bg-muted/10"}>
                        <td className="px-4 py-3">
                          <span className="font-bold font-mono text-foreground">{c.code}</span>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {c.discount_type === "percentage" ? `${c.discount_value}%` : formatPrice(c.discount_value)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.uses_count}{c.max_uses ? ` / ${c.max_uses}` : " (∞)"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : "Never"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch checked={c.is_active} onCheckedChange={() => toggleCoupon(c.id, c.is_active)} />
                        </td>
                        <td className="px-4 py-3 text-right">
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
      </DialogContent>
    </Dialog>
  );
}

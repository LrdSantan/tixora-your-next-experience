import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, Plus, MapPin, Calendar, Ticket, Share2, Landmark, Check, ChevronsUpDown, Loader2, Trash2, BarChart3, Scan, Lock, Unlock, Settings, EyeOff, Mail, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/contexts/auth-context";
import { getSupabaseClient } from "@/lib/supabase";
import { formatDate, formatPrice } from "@/lib/mock-data";
import { formatEventDateDisplay } from "@/lib/date-utils";
import { getEventImage } from "@/lib/event-image";
import { EditCoverImageButton } from "@/components/EditCoverImageButton";
import { OrganizerCouponsModal } from "@/components/OrganizerCouponsModal";
import { OrganizerGuestList } from "@/components/OrganizerGuestList";
import { RegistrationQuestionsEditor } from "@/components/RegistrationQuestionsEditor";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const NIGERIAN_BANKS = [
  "Access Bank", "GTBank", "First Bank", "Zenith Bank", "UBA",
  "Sterling Bank", "Fidelity Bank", "Polaris Bank", "Union Bank",
  "Wema Bank", "Stanbic IBTC", "FCMB", "Ecobank", "Keystone Bank",
  "Jaiz Bank", "Opay", "Palmpay", "Kuda Bank", "Moniepoint"
].sort();

type OrganizerEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  category: string;
  cover_image_url: string | null;
  status: string;
  created_at: string;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  scanner_mode: "standard" | "express";
  scanner_mode_locked: boolean;
  is_multi_day: boolean | null;
  event_days: string[] | null;
  is_private: boolean;
  ticket_tiers: Array<{
    id: string;
    name: string;
    price: number;
    total_quantity: number;
    remaining_quantity: number;
  }>;
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  suspended: "bg-amber-100 text-amber-700 border-amber-200",
  pending: "bg-blue-100 text-blue-700 border-blue-200",
  expired: "bg-neutral-100 text-neutral-500 border-neutral-200",
  deleted: "bg-red-100 text-red-600 border-red-200",
};

const ADMIN_EMAIL = "yusufquadir50@gmail.com";
const SITE_URL = "https://tixoraafrica.com.ng";

function OrganizerPayoutModal({ event, onSuccess }: { event: OrganizerEvent, onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [bankSearchOpen, setBankSearchOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = getSupabaseClient();
  
  const [formData, setFormData] = useState({
    bankName: event.bank_name || "",
    accountNumber: event.account_number || "",
    accountName: event.account_name || ""
  });

  const isValid = formData.bankName && formData.accountNumber.length === 10 && formData.accountName;

  const handleUpdate = async () => {
    if (!supabase || !isValid) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          bank_name: formData.bankName,
          account_number: formData.accountNumber,
          account_name: formData.accountName
        })
        .eq("id", event.id);

      if (error) throw error;
      toast.success("Payout details updated!");
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to update payout details");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3 border-border hover:bg-muted" title="Manage Payout">
          <Landmark className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payout Details: {event.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bank Name</label>
            <Popover open={bankSearchOpen} onOpenChange={setBankSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={bankSearchOpen}
                  className="w-full justify-between h-10 px-3 font-normal"
                >
                  {formData.bankName ? formData.bankName : "Search bank..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search bank..." />
                  <CommandList>
                    <CommandEmpty>No bank found.</CommandEmpty>
                    <CommandGroup>
                      {NIGERIAN_BANKS.map((bank) => (
                        <CommandItem
                          key={bank}
                          value={bank}
                          onSelect={(currentValue) => {
                            setFormData({ ...formData, bankName: currentValue });
                            setBankSearchOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.bankName === bank ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {bank}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Account Number</label>
            <Input 
              placeholder="10 digits" 
              maxLength={10} 
              value={formData.accountNumber} 
              onChange={e => setFormData({ ...formData, accountNumber: e.target.value.replace(/\D/g, "") })} 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Account Name</label>
            <Input 
              placeholder="Name on account" 
              value={formData.accountName} 
              onChange={e => setFormData({ ...formData, accountName: e.target.value })} 
            />
          </div>

          <Button 
            className="w-full mt-4" 
            disabled={!isValid || isSubmitting}
            onClick={handleUpdate}
          >
            {isSubmitting ? "Saving..." : "Save Payout Details"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrganizerTiersEditor({ event, onSaved }: { event: OrganizerEvent, onSaved: () => void }) {
  const supabase = getSupabaseClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tiers, setTiers] = useState<any[]>([]);
  const [waitlistCounts, setWaitlistCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;
    async function loadTiers() {
      if (!supabase) return;
      setIsLoading(true);
      const { data, error } = await supabase
        .from('ticket_tiers')
        .select('id, event_id, name, description, price, total_quantity, remaining_quantity, waitlist_enabled')
        .eq('event_id', event.id)
        .order('price', { ascending: true });
        
      if (!error && data && isMounted) {
        setTiers(data.map(t => ({
          ...t,
          tickets_sold: t.total_quantity - t.remaining_quantity,
          isFree: Number(t.price) === 0,
          waitlist_enabled: t.waitlist_enabled ?? false,
        })));

        // Load waitlist counts
        const counts: Record<string, number> = {};
        await Promise.all(data.map(async (t) => {
          const { count } = await supabase!
            .from('waitlist')
            .select('*', { count: 'exact', head: true })
            .eq('tier_id', t.id)
            .eq('status', 'waiting');
          counts[t.id] = count ?? 0;
        }));
        if (isMounted) setWaitlistCounts(counts);
      }
      if (isMounted) setIsLoading(false);
    }
    loadTiers();
    return () => { isMounted = false; };
  }, [event.id, supabase]);

  const updateTier = (index: number, field: string, value: any) => {
    const newTiers = [...tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setTiers(newTiers);
  };

  const addTier = () => {
    setTiers([...tiers, {
      id: null,
      event_id: event.id,
      name: '',
      description: '',
      price: 0,
      isFree: true,
      total_quantity: 0,
      remaining_quantity: 0,
      tickets_sold: 0
    }]);
  };

  const removeTier = (index: number) => {
    const tier = tiers[index];
    if (tier.tickets_sold > 0) {
      toast.error("Cannot delete a tier with existing sales");
      return;
    }
    
    if (!tier.id) {
      const newTiers = [...tiers];
      newTiers.splice(index, 1);
      setTiers(newTiers);
      return;
    }
    
    const newTiers = [...tiers];
    newTiers[index] = { ...tier, _deleted: true };
    setTiers(newTiers);
  };

  const handleSave = async () => {
    if (!supabase) return;
    
    // Basic validation
    for (const t of tiers) {
      if (!t._deleted && (!t.name.trim() || t.price === '' || t.price < 0 || t.total_quantity === '' || t.total_quantity < t.tickets_sold)) {
        toast.error("Please fill all fields correctly. Capacity cannot be less than sold tickets.");
        return;
      }
    }
    
    setIsSaving(true);
    try {
      const toDelete = tiers.filter(t => t.id && t._deleted);
      for (const t of toDelete) {
        const { error } = await supabase.from('ticket_tiers').delete().eq('id', t.id);
        if (error) throw error;
      }
      
      const toUpdate = tiers.filter(t => t.id && !t._deleted);
      for (const t of toUpdate) {
        const newRemaining = t.total_quantity - t.tickets_sold;
        const { error } = await supabase.from('ticket_tiers').update({
          name: t.name,
          price: t.price,
          total_quantity: t.total_quantity,
          remaining_quantity: newRemaining,
          waitlist_enabled: t.waitlist_enabled ?? false,
        }).eq('id', t.id);
        if (error) throw error;
      }
      
      const toInsert = tiers.filter(t => !t.id && !t._deleted);
      if (toInsert.length > 0) {
        const insertPayload = toInsert.map(t => ({
          event_id: t.event_id,
          name: t.name,
          description: t.name || 'Tier',
          price: t.price,
          total_quantity: t.total_quantity,
          remaining_quantity: t.total_quantity
        }));
        const { error } = await supabase.from('ticket_tiers').insert(insertPayload);
        if (error) throw error;
      }
      
      toast.success("Ticket tiers updated successfully");
      onSaved();
    } catch (err: any) {
      toast.error(err.message || "Failed to save ticket tiers");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-2 pt-3 border-t border-border space-y-3 bg-muted/30 rounded-lg p-3 mx-4 mb-4">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        <Ticket className="w-4 h-4 text-primary" /> Edit Tiers
      </h4>
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {tiers.filter(t => !t._deleted).map((tier, idx) => {
             const originalIdx = tiers.indexOf(tier);
             const wlCount = waitlistCounts[tier.id] ?? 0;
             return (
              <div key={tier.id || idx} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Input 
                    className="h-8 text-sm flex-1 bg-background" 
                    placeholder="Tier name" 
                    value={tier.name} 
                    onChange={e => updateTier(originalIdx, 'name', e.target.value)} 
                  />
                  <div className="flex items-center gap-1.5 mr-1 bg-background px-2 py-1 rounded-md border border-input h-8">
                    <Label htmlFor={`free-${tier.id || idx}`} className="text-[10px] font-bold text-muted-foreground uppercase cursor-pointer select-none">Free</Label>
                    <Switch 
                      id={`free-${tier.id || idx}`}
                      checked={tier.isFree}
                      onCheckedChange={(checked) => {
                        const newTiers = [...tiers];
                        newTiers[originalIdx] = { 
                          ...newTiers[originalIdx], 
                          isFree: checked,
                          price: checked ? 0 : (newTiers[originalIdx].price || 0)
                        };
                        setTiers(newTiers);
                      }}
                      className="scale-75"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-muted-foreground">₦</span>
                    <Input 
                      className={cn("h-8 text-sm w-24 bg-background pl-6", tier.isFree && "bg-muted text-muted-foreground")}
                      type="number"
                      min="0"
                      placeholder="Price" 
                      value={tier.isFree ? 0 : tier.price} 
                      onChange={e => updateTier(originalIdx, 'price', e.target.value === '' ? '' : parseFloat(e.target.value))} 
                      disabled={tier.isFree}
                    />
                  </div>
                  <Input 
                    className="h-8 text-sm w-20 bg-background" 
                    type="number"
                    min={tier.tickets_sold}
                    placeholder="Cap" 
                    value={tier.total_quantity} 
                    onChange={e => updateTier(originalIdx, 'total_quantity', e.target.value === '' ? '' : parseInt(e.target.value, 10))} 
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                    onClick={() => removeTier(originalIdx)}
                    title={tier.tickets_sold > 0 ? "Cannot delete tier with existing sales" : "Delete tier row"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {/* Waitlist toggle row */}
                <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-md px-2.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`wl-${tier.id || idx}`}
                      checked={tier.waitlist_enabled ?? false}
                      onCheckedChange={(checked) => updateTier(originalIdx, 'waitlist_enabled', checked)}
                      className="scale-75"
                    />
                    <Label htmlFor={`wl-${tier.id || idx}`} className="text-[11px] font-medium text-amber-800 cursor-pointer select-none">
                      Enable Waitlist
                    </Label>
                  </div>
                  {tier.id && wlCount > 0 && (
                    <span className="text-[10px] font-semibold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                      {wlCount} waiting
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          
          <Button variant="outline" size="sm" className="w-full h-8 border-dashed mt-2 bg-background" onClick={addTier}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add tier
          </Button>
          
          <div className="flex justify-end pt-2">
             <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8 text-xs">
               {isSaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
               Save changes
             </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrganizerEventStats({ eventId }: { eventId: string }) {
  const supabase = getSupabaseClient();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{ totalRevenue: number; tiers: { name: string; count: number; revenue: number }[] } | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadStats() {
      if (!supabase) return;
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('tickets')
        .select('amount_paid, tier_id, ticket_tiers(name)')
        .eq('event_id', eventId)
        .eq('status', 'confirmed');
        
      if (error) {
        toast.error("Failed to load event stats");
        if (isMounted) setIsLoading(false);
        return;
      }

      if (data && isMounted) {
        let totalRevenue = 0;
        const tierMap = new Map<string, { count: number; revenue: number }>();
        
        data.forEach((ticket: any) => {
          const amount = (ticket.amount_paid || 0) / 100;
          const tierName = ticket.ticket_tiers?.name || 'Unknown Tier';
          
          totalRevenue += amount;
          
          if (!tierMap.has(tierName)) {
            tierMap.set(tierName, { count: 0, revenue: 0 });
          }
          
          const tierStat = tierMap.get(tierName)!;
          tierStat.count += 1;
          tierStat.revenue += amount;
        });

        const tiers = Array.from(tierMap.entries()).map(([name, stat]) => ({
          name,
          ...stat
        }));
        
        setStats({ totalRevenue, tiers });
      }
      if (isMounted) setIsLoading(false);
    }
    
    loadStats();
    return () => { isMounted = false; };
  }, [eventId, supabase]);

  return (
    <div className="mt-2 pt-3 border-t border-border space-y-3 bg-muted/30 rounded-lg p-4 mx-4 mb-4">
      <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
        <BarChart3 className="w-4 h-4 text-green-600" /> Revenue & Sales Breakdown
      </h4>
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : stats ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-background border border-border rounded-md p-3">
            <span className="text-sm font-medium text-muted-foreground">Total Revenue</span>
            <span className="text-lg font-bold text-green-600">{formatPrice(stats.totalRevenue)}</span>
          </div>
          
          {stats.tiers.length > 0 ? (
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Per Tier Breakdown</span>
              <div className="border border-border rounded-md overflow-hidden bg-background">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground border-b border-border">
                    <tr>
                      <th className="text-left font-medium p-2">Tier</th>
                      <th className="text-right font-medium p-2">Sold</th>
                      <th className="text-right font-medium p-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {stats.tiers.map((tier, idx) => (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-2 font-medium">{tier.name}</td>
                        <td className="p-2 text-right text-muted-foreground">{tier.count}</td>
                        <td className="p-2 text-right text-green-600 font-medium">{formatPrice(tier.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-sm text-center text-muted-foreground py-2">No confirmed tickets yet.</div>
          )}
        </div>
      ) : (
        <div className="text-sm text-center text-muted-foreground py-2">Failed to load stats.</div>
      )}
    </div>
  );
}

function OrganizerScannerSettingsModal({ event, onSuccess }: { event: OrganizerEvent, onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"standard" | "express">(event.scanner_mode || "standard");
  const [locked, setLocked] = useState(event.scanner_mode_locked || false);
  const supabase = getSupabaseClient();

  const handleSave = async () => {
    if (!supabase) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          scanner_mode: mode,
          scanner_mode_locked: locked
        })
        .eq("id", event.id);

      if (error) throw error;
      toast.success("Scanner settings updated!");
      setOpen(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to update scanner settings");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (val) {
        setMode(event.scanner_mode || "standard");
        setLocked(event.scanner_mode_locked || false);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3 border-border hover:bg-muted" title="Scanner Settings">
          <Scan className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scanner Settings: {event.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <label className="text-sm font-medium">Scanner Mode</label>
            <div className="grid grid-cols-2 gap-3">
              <div 
                className={cn(
                  "border rounded-xl p-4 cursor-pointer transition-all", 
                  mode === "standard" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/50"
                )}
                onClick={() => setMode("standard")}
              >
                <div className="font-semibold text-sm mb-1">Standard</div>
                <div className="text-xs text-muted-foreground">Review guest info before checking in</div>
              </div>
              <div 
                className={cn(
                  "border rounded-xl p-4 cursor-pointer transition-all", 
                  mode === "express" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/50"
                )}
                onClick={() => setMode("express")}
              >
                <div className="font-semibold text-sm mb-1 text-primary">Express</div>
                <div className="text-xs text-muted-foreground">Auto check-in on scan — no tap needed</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between space-x-2 border rounded-xl p-4 bg-muted/20">
            <div className="space-y-0.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                {locked ? <Lock className="w-4 h-4 text-amber-500" /> : <Unlock className="w-4 h-4 text-muted-foreground" />}
                Lock Mode for Scanners
              </label>
              <div className="text-xs text-muted-foreground">
                Locking prevents scanners from changing the mode during the event.
              </div>
            </div>
            <Switch checked={locked} onCheckedChange={setLocked} />
          </div>

          <Button 
            className="w-full" 
            disabled={isSubmitting}
            onClick={handleSave}
          >
            {isSubmitting ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrganizerEventSettings({ event, onUpdate }: { event: OrganizerEvent, onUpdate: () => void }) {
  const supabase = getSupabaseClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleTogglePrivate = async (checked: boolean) => {
    if (!supabase) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({ is_private: checked })
        .eq("id", event.id);

      if (error) throw error;
      toast.success(checked ? "Event is now private" : "Event is now public");
      onUpdate();
    } catch (err: any) {
      toast.error(err.message || "Failed to update privacy status");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="mt-2 pt-3 border-t border-border space-y-3 bg-muted/30 rounded-lg p-4 mx-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <EyeOff className="w-3.5 h-3.5 text-primary" /> Private Event
          </Label>
          <p className="text-xs text-muted-foreground">Only people with the link can find this event</p>
        </div>
        <Switch 
          checked={event.is_private} 
          onCheckedChange={handleTogglePrivate}
          disabled={isUpdating}
        />
      </div>
    </div>
  );
}

function OrganizerGuestBlastModal({ event }: { event: OrganizerEvent }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { user } = useAuth();
  const supabase = getSupabaseClient();

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !supabase) return;
    if (message.length < 10) {
      toast.error("Message must be at least 10 characters");
      return;
    }

    try {
      setIsSending(true);
      const { data, error } = await supabase.functions.invoke("send-guest-blast", {
        body: {
          event_id: event.id,
          subject,
          message,
          channel: "email",
          organizer_id: user.id
        }
      });

      if (error) throw error;
      
      // Handle the case where the function returned success: true but had errors
      if (data.errors && data.errors.length > 0 && data.sent === 0) {
        throw new Error(data.errors[0]);
      }

      toast.success(`Message sent to ${data.sent} guests!`);
      setOpen(false);
      setSubject("");
      setMessage("");
    } catch (err: any) {
      console.error("[GuestBlast Error]", err);
      toast.error(err.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 px-3 border-border hover:bg-muted" title="Message Guests">
          <Mail className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Message Your Guests</DialogTitle>
          <DialogDescription>
            Send a direct update to all confirmed ticket holders for <span className="font-semibold text-foreground">"{event.title}"</span>.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSend} className="space-y-5 mt-4">

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input 
              id="subject" 
              placeholder="e.g. Important update regarding tonight's event" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea 
              id="message" 
              placeholder="Write your message here..." 
              className="min-h-[150px] resize-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
            <p className="text-[10px] text-muted-foreground">This message will be sent to all confirmed attendees.</p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSending || !subject || message.length < 10} 
              className="bg-primary text-white font-bold px-6"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Email Blast"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrganizerEventCard({ event, onUpdate, onShare, onDelete, isPast }: { event: OrganizerEvent, onUpdate: () => void, onShare: (e: React.MouseEvent) => void, onDelete: (id: string) => void, isPast?: boolean }) {
  const [isTiersExpanded, setIsTiersExpanded] = useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [isQuestionsExpanded, setIsQuestionsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const supabase = getSupabaseClient();
  
  const totalSold = event.ticket_tiers.reduce(
    (sum, t) => sum + (t.total_quantity - t.remaining_quantity),
    0
  );

  const handleDelete = async () => {
    if (totalSold > 0) {
      toast.error("Cannot delete an event with existing ticket sales. Contact support if needed.");
      setShowDeleteDialog(false);
      return;
    }
    
    if (!supabase) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);
        
      if (error) throw error;
      toast.success("Event deleted successfully");
      setShowDeleteDialog(false);
      onDelete(event.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete event");
      setIsDeleting(false);
    }
  };

  const totalCapacity = event.ticket_tiers.reduce((sum, t) => sum + t.total_quantity, 0);
  const lowestPrice = event.ticket_tiers.length > 0
    ? Math.min(...event.ticket_tiers.map((t) => t.price))
    : null;
  const statusClass = STATUS_STYLES[event.status] ?? STATUS_STYLES.pending;

  return (
    <div className={cn("group bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 duration-200 flex flex-col", isPast && "opacity-80 grayscale-[0.3]")}>
      <Link to={`/events/${event.id}`} className="block">
        <div className="aspect-[16/9] overflow-hidden relative bg-muted">
          <img
            src={event.cover_image_url || `https://source.unsplash.com/800x450/?${event.category}`}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <span
            className={`absolute top-2 right-2 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${isPast ? "bg-neutral-100 text-neutral-600 border-neutral-200" : statusClass}`}
          >
            {isPast ? "Past" : event.status}
          </span>
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1 pb-0">
        <Link to={`/events/${event.id}`}>
          <h3 className="font-bold text-foreground text-base leading-snug line-clamp-2 hover:text-primary transition-colors">
            {event.title}
          </h3>
        </Link>

        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{formatEventDateDisplay(event.date, event.is_multi_day || false, event.event_days || [])} · {event.time}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="line-clamp-1">{event.venue}, {event.city}</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Ticket className="w-3.5 h-3.5" />
            {totalSold} / {totalCapacity} sold
          </span>
          {lowestPrice !== null && (
            <span className="font-semibold text-primary">
              {lowestPrice === 0 ? "Free" : `From ${formatPrice(lowestPrice)}`}
            </span>
          )}
        </div>

        <div className="mt-3 pt-3 pb-3 border-t border-border flex items-center flex-wrap gap-2">
          {!isPast && (
            <>
              <EditCoverImageButton 
                eventId={event.id} 
                onSuccess={onUpdate}
                className="w-auto"
              />
              <OrganizerCouponsModal eventId={event.id} eventTitle={event.title} />
              
              <Button
                variant="outline"
                size="sm"
                className={cn("h-9 gap-1.5 px-3 border-border hover:bg-muted", isTiersExpanded && "bg-muted")}
                onClick={() => setIsTiersExpanded(!isTiersExpanded)}
                title="Edit Tiers"
              >
                <Ticket className="w-3.5 h-3.5" />
              </Button>

              <OrganizerPayoutModal event={event} onSuccess={onUpdate} />
              
              <OrganizerScannerSettingsModal event={event} onSuccess={onUpdate} />

              <OrganizerGuestBlastModal event={event} />

              <OrganizerGuestList eventId={event.id} eventTitle={event.title} />

              <Button
                variant="outline"
                size="sm"
                className={cn("h-9 gap-1.5 px-3 border-border hover:bg-muted", isQuestionsExpanded && "bg-muted")}
                onClick={() => setIsQuestionsExpanded(!isQuestionsExpanded)}
                title="Registration Questions"
              >
                <ClipboardList className="w-3.5 h-3.5" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                className={cn("h-9 gap-1.5 px-3 border-border hover:bg-muted", isSettingsExpanded && "bg-muted")}
                onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                title="Event Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>

              <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 px-3 border-border hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                    title="Delete Event"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Delete Event</DialogTitle>
                  </DialogHeader>
                  <div className="py-4 text-sm text-muted-foreground">
                    This will permanently delete the event. This cannot be undone.
                  </div>
                  <div className="flex justify-end gap-3 mt-4">
                    <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>Cancel</Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      Delete
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          <Button
            variant="outline"
            size="sm"
            className={cn("h-9 gap-1.5 px-3 border-border hover:bg-muted", isPast && "flex-1")}
            onClick={onShare}
            title="Share Event"
          >
            <Share2 className="w-3.5 h-3.5" />
            {isPast && <span className="ml-1">Share</span>}
          </Button>
        </div>

        {/* Quick Share and Stats buttons */}
        <div className="pb-4 px-4 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-9 gap-1.5 px-3 text-muted-foreground hover:text-foreground hover:bg-muted/50", isStatsExpanded && "bg-muted text-foreground")}
            onClick={() => setIsStatsExpanded(!isStatsExpanded)}
            title="View Stats"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">View Stats</span>
          </Button>

          <div className="flex items-center gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Check out this event: ${event.title} ${SITE_URL}/events/${event.id}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-border text-muted-foreground hover:text-green-600 hover:border-green-100 hover:bg-green-50 transition-all duration-200"
            title="Share on WhatsApp"
          >
            <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L.054 23.446a.5.5 0 0 0 .613.613l5.63-1.476A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.667-.513-5.195-1.41l-.372-.217-3.853 1.01 1.027-3.749-.237-.384A9.96 9.96 0 0 1 2 12c0-5.514 4.486-10 10-10s10 4.486 10 10-4.486 10-10 10z"/>
            </svg>
          </a>

          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out this event: ${event.title}`)}&url=${encodeURIComponent(`${SITE_URL}/events/${event.id}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground hover:bg-neutral-50 transition-all duration-200"
            title="Share on X / Twitter"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          </div>
        </div>
      </div>
      
      {isTiersExpanded && (
        <OrganizerTiersEditor event={event} onSaved={() => { setIsTiersExpanded(false); onUpdate(); }} />
      )}

      {isQuestionsExpanded && (
        <RegistrationQuestionsEditor eventId={event.id} />
      )}

      {isSettingsExpanded && (
        <OrganizerEventSettings event={event} onUpdate={onUpdate} />
      )}
      
      {isStatsExpanded && (
        <OrganizerEventStats eventId={event.id} />
      )}
    </div>
  );
}
export default function OrganizerEventsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const supabase = getSupabaseClient();

  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "past">("active");

  const now = new Date();
  
  const isEventPast = (event: OrganizerEvent) => {
    if (event.is_multi_day && event.event_days && event.event_days.length > 0) {
      const latestDateStr = [...event.event_days].sort().reverse()[0];
      const latestDate = new Date(`${latestDateStr}T23:59:59`);
      return latestDate < now;
    } else {
      const eventDate = new Date(`${event.date}T23:59:59`);
      return eventDate < now;
    }
  };

  const activeEvents = events.filter(e => !isEventPast(e));
  const pastEvents = events.filter(e => isEventPast(e));
  const displayedEvents = activeTab === "active" ? activeEvents : pastEvents;

  const handleLocalDelete = (eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
  };

  const handleShare = (event: OrganizerEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${SITE_URL}/events/${event.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Event link copied to clipboard!");
    }).catch(() => {
      // Fallback for browsers that block clipboard in non-secure contexts
      toast.error("Could not copy link — please copy it manually.");
    });
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/login?redirect=/organizer/events");
  }, [user, authLoading, navigate]);

  const fetchEvents = () => {
    if (!user || authLoading || !supabase) return;
    setIsLoading(true);

    supabase
      .from("events")
      .select(
        `id, title, date, time, venue, city, category, cover_image_url, status, created_at,
         bank_name, account_number, account_name, is_multi_day, event_days, scanner_mode, scanner_mode_locked, is_private,
         ticket_tiers ( id, name, price, total_quantity, remaining_quantity )`
      )
      .eq("organizer_id", user.id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error("Failed to load your events");
        else setEvents((data ?? []) as OrganizerEvent[]);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchEvents();
  }, [user, authLoading, supabase]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-5 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
              <Skeleton className="aspect-[16/9] w-full rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
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
            <CalendarDays className="w-6 h-6 text-primary" />
            My Events
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Events you've created on Tixora.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
            <button
              onClick={() => setActiveTab("active")}
              className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", activeTab === "active" && "bg-background text-foreground shadow")}
            >
              Active Events
            </button>
            <button
              onClick={() => setActiveTab("past")}
              className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", activeTab === "past" && "bg-background text-foreground shadow")}
            >
              Past Events
            </button>
          </div>
          <Button asChild className="bg-primary text-primary-foreground gap-2 shrink-0">
            <Link to="/create-event">
              <Plus className="w-4 h-4" />
              Create Event
            </Link>
          </Button>
        </div>
      </div>

      {/* Loading skeletons */}
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
              <Skeleton className="aspect-[16/9] w-full rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : displayedEvents.length === 0 ? (
        /* Empty state */
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-20 text-center">
          <CalendarDays className="w-14 h-14 text-primary mx-auto mb-5 opacity-60" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {activeTab === "active" ? "No active events yet. Create your first event." : "No past events found."}
          </h2>
          <p className="text-sm text-muted-foreground mb-8 max-w-sm mx-auto">
            {activeTab === "active" 
              ? "Get started by creating your first event — set up tiers, accept payments, and manage attendees all in one place."
              : "Your previously hosted events will appear here once their dates have passed."}
          </p>
          {activeTab === "active" && (
            <Button asChild className="bg-primary text-primary-foreground gap-2">
              <Link to="/create-event">
                <Plus className="w-4 h-4" />
                Create Event
              </Link>
            </Button>
          )}
        </div>
      ) : (
        /* Events grid */
        <div className="grid gap-5 sm:grid-cols-2">
          {displayedEvents.map((event) => (
            <OrganizerEventCard 
              key={event.id} 
              event={event} 
              onUpdate={fetchEvents} 
              onShare={(e) => handleShare(event, e)}
              onDelete={handleLocalDelete}
              isPast={activeTab === "past"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

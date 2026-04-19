import { useState, useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Navigation, MapPin, Calendar, Clock, Check, ChevronsUpDown, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { CATEGORIES } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const NIGERIAN_BANKS = [
  "Access Bank", "GTBank", "First Bank", "Zenith Bank", "UBA",
  "Sterling Bank", "Fidelity Bank", "Polaris Bank", "Union Bank",
  "Wema Bank", "Stanbic IBTC", "FCMB", "Ecobank", "Keystone Bank",
  "Jaiz Bank", "Opay", "Palmpay", "Kuda Bank", "Moniepoint"
].sort();

type TierInput = { id: string; name: string; description: string; price: number | ""; quantity: number | "" };

export default function CreateEvent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const supabase = getSupabaseClient();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    date: "",
    time: "",
    venue: "",
    city: "",
    bankName: "",
    accountNumber: "",
    accountName: "",
  });
  const [bankSearchOpen, setBankSearchOpen] = useState(false);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [tiers, setTiers] = useState<TierInput[]>([
    { id: "1", name: "Regular", description: "General admission", price: 5000, quantity: 100 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  if (!loading && !user) {
    return <Navigate to="/login" replace />;
  }

  const handleAddTier = () => {
    if (tiers.length >= 5) {
      toast.error("Maximum 5 ticket tiers allowed");
      return;
    }
    setTiers([...tiers, { id: Math.random().toString(), name: "", description: "", price: 0, quantity: 0 }]);
  };

  const handleRemoveTier = (id: string) => {
    if (tiers.length <= 1) {
      toast.error("At least 1 ticket tier is required");
      return;
    }
    setTiers(tiers.filter((t) => t.id !== id));
  };

  const handleTierChange = (id: string, field: keyof TierInput, value: string | number) => {
    setTiers(tiers.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const errors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!formData.title.trim()) errs.title = "Title is required.";
    if (formData.description.trim().length < 30) errs.description = "Description must be at least 30 characters.";
    if (!formData.category) errs.category = "Category is required.";
    if (!formData.venue.trim()) errs.venue = "Venue is required.";
    if (!formData.city.trim()) errs.city = "City is required.";

    // Payout Details Validation
    if (!formData.bankName) errs.bankName = "Bank name is required.";
    if (!formData.accountNumber.trim()) {
      errs.accountNumber = "Account number is required.";
    } else if (!/^\d{10}$/.test(formData.accountNumber)) {
      errs.accountNumber = "Account number must be exactly 10 digits.";
    }
    if (!formData.accountName.trim()) errs.accountName = "Account name is required.";
    
    if (!isMultiDay) {
      if (!formData.date) {
        errs.date = "Date is required.";
      } else {
        const selectedDate = new Date(formData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          errs.date = "Event date must be in the future.";
        }
      }
    } else {
      if (!formData.date) errs.date = "Start date is required.";
      if (!endDate) errs.endDate = "End date is required.";
      if (formData.date && endDate && endDate <= formData.date) {
        errs.endDate = "End date must be after start date.";
      }
      if (formData.date) {
        const selectedDate = new Date(formData.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          errs.date = "Start date must be in the future.";
        }
      }
    }
    if (!formData.time) errs.time = "Time is required.";
    if (!coverImage) errs.coverImage = "Cover image is required to be uploaded.";

    if (tiers.length === 0) {
      errs.tiers = "At least 1 ticket tier is required.";
    } else {
      for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i];
        if (!t.name.trim() || t.price === "" || t.price < 0 || t.quantity === "" || t.quantity <= 0) {
          errs.tiers = "Please ensure all tiers have a name, price >= 0, and quantity > 0.";
          break;
        }
      }
    }
    return errs;
  }, [formData, coverImage, tiers]);

  const isValid = Object.keys(errors).length === 0;

  // Generate array of date strings between start and end date (inclusive)
  const generateEventDays = (start: string, end: string): string[] => {
    const days: string[] = [];
    const current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValid) return;

    // Check if terms already agreed
    const hasAgreedBefore = localStorage.getItem("tixora_terms_agreed_v1") === "true";
    
    if (!hasAgreedBefore) {
      setShowTermsModal(true);
      return;
    }

    await createEvent();
  };

  const createEvent = async () => {
    if (!supabase) {
      toast.error("Supabase is not connected.");
      return;
    }

    try {
      setIsSubmitting(true);

      const fileExt = coverImage!.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('event-covers')
        .upload(fileName, coverImage!);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('event-covers')
        .getPublicUrl(fileName);

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          date: formData.date,
          time: formData.time,
          venue: formData.venue,
          city: formData.city,
          cover_image_url: publicUrlData.publicUrl,
          banner_url: publicUrlData.publicUrl,
          organizer_id: user!.id,
          organizer_email: user!.email,
          status: 'active',
          bank_name: formData.bankName,
          account_number: formData.accountNumber,
          account_name: formData.accountName,
          is_multi_day: isMultiDay,
          event_days: isMultiDay ? generateEventDays(formData.date, endDate) : [],
        })
        .select()
        .single();

      if (eventError) throw eventError;

      const tiersToInsert = tiers.map(t => ({
        event_id: eventData.id,
        name: t.name,
        description: t.description,
        price: t.price,
        total_quantity: t.quantity,
        remaining_quantity: t.quantity,
      }));

      const { error: tiersError } = await supabase
        .from('ticket_tiers')
        .insert(tiersToInsert);

      if (tiersError) throw tiersError;

      toast.success("Your event has been successfully created and is now live!");
      navigate("/");
    } catch (err: any) {
      console.error("[CreateEvent Error]", err);
      toast.error(err.message || "Something went wrong creating the event.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAgreeTerms = async () => {
    localStorage.setItem("tixora_terms_agreed_v1", "true");
    setShowTermsModal(false);
    await createEvent();
  };

  if (loading) {
    return <div className="min-h-[50vh] flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight mb-2">Create New Event</h1>
        <p className="text-muted-foreground">Fill in the details below to list your event on Tixora.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10" noValidate>
        {/* Section 1: Event Details */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold border-b pb-2">1. Event Details</h2>
          
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Event Name <span className="text-destructive">*</span></label>
              <Input placeholder="e.g. Burna Boy Live in Lagos" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description <span className="text-destructive">*</span></label>
              <Textarea placeholder="Describe your event..." className="min-h-[120px]" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category <span className="text-destructive">*</span></label>
                <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                    ))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Cover Image <span className="text-destructive">*</span></label>
                <div className="relative">
                  <Input type="file" accept="image/*" onChange={(e) => setCoverImage(e.target.files?.[0] || null)} className="pl-10 h-10 w-full" />
                  <Upload className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                </div>
                {errors.coverImage && <p className="text-xs text-destructive">{errors.coverImage}</p>}
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Date & Location */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold border-b pb-2">2. Date & Location</h2>

          {/* Multi-day toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <CalendarRange className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Multi-day event</p>
                <p className="text-xs text-muted-foreground">Event spans across multiple days</p>
              </div>
            </div>
            <Switch
              id="multi-day-toggle"
              checked={isMultiDay}
              onCheckedChange={(checked) => {
                setIsMultiDay(checked);
                if (!checked) setEndDate("");
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {isMultiDay ? "Start Date" : "Date"} <span className="text-destructive">*</span>
              </label>
              <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>

            {isMultiDay ? (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  End Date <span className="text-destructive">*</span>
                </label>
                <Input
                  type="date"
                  value={endDate}
                  min={formData.date || undefined}
                  onChange={e => setEndDate(e.target.value)}
                />
                {(errors as any).endDate && <p className="text-xs text-destructive">{(errors as any).endDate}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><Clock className="w-4 h-4" /> Start Time <span className="text-destructive">*</span></label>
                <Input type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                {errors.time && <p className="text-xs text-destructive">{errors.time}</p>}
              </div>
            )}

            {isMultiDay && (
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2"><Clock className="w-4 h-4" /> Start Time <span className="text-destructive">*</span></label>
                <Input type="time" value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                {errors.time && <p className="text-xs text-destructive">{errors.time}</p>}
              </div>
            )}

            {isMultiDay && formData.date && endDate && endDate > formData.date && (
              <div className="col-span-full">
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm text-primary font-medium flex items-center gap-2">
                  <CalendarRange className="w-4 h-4 shrink-0" />
                  This event will span {generateEventDays(formData.date, endDate).length} days: {generateEventDays(formData.date, endDate).map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).join(', ')}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2"><MapPin className="w-4 h-4" /> Venue Name <span className="text-destructive">*</span></label>
              <Input placeholder="e.g. Eko Convention Centre" value={formData.venue} onChange={e => setFormData({ ...formData, venue: e.target.value })} />
              {errors.venue && <p className="text-xs text-destructive">{errors.venue}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2"><Navigation className="w-4 h-4" /> City <span className="text-destructive">*</span></label>
              <Input placeholder="e.g. Lagos" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
              {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
            </div>
          </div>
        </section>

        {/* Section 3: Ticket Tiers */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-xl font-bold">3. Ticket Tiers</h2>
            <Button type="button" variant="outline" size="sm" onClick={handleAddTier} disabled={tiers.length >= 5} className="gap-1.5 h-8">
              <Plus className="w-3.5 h-3.5" /> Add Tier
            </Button>
          </div>
          {errors.tiers && <p className="text-sm text-destructive font-medium">{errors.tiers}</p>}
          <div className="space-y-4">
            {tiers.map((tier, index) => (
              <div key={tier.id} className="p-5 border rounded-xl bg-card relative">
                <div className="absolute top-4 right-4">
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveTier(tier.id)} disabled={tiers.length === 1} className="text-muted-foreground hover:text-destructive h-8 w-8">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Tier {index + 1}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tier Name <span className="text-destructive">*</span></label>
                    <Input placeholder="e.g. VIP" value={tier.name} onChange={e => handleTierChange(tier.id, "name", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Quantity Available <span className="text-destructive">*</span></label>
                    <Input type="number" min="1" placeholder="e.g. 100" value={tier.quantity} onChange={e => handleTierChange(tier.id, "quantity", e.target.value === "" ? "" : parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Price (₦) <span className="text-destructive">*</span></label>
                    <Input type="number" min="0" placeholder="e.g. 5000" value={tier.price} onChange={e => handleTierChange(tier.id, "price", e.target.value === "" ? "" : parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description (Optional)</label>
                    <Input placeholder="What does this include?" value={tier.description} onChange={e => handleTierChange(tier.id, "description", e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Payout Details */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold border-b pb-2">4. Payout Details</h2>
          <p className="text-sm text-muted-foreground">Enter the bank details where you want to receive your payouts from ticket sales.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bank Name <span className="text-destructive">*</span></label>
              <Popover open={bankSearchOpen} onOpenChange={setBankSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={bankSearchOpen}
                    className="w-full justify-between h-11 px-4 font-normal"
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
              {errors.bankName && <p className="text-xs text-destructive">{errors.bankName}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Account Number <span className="text-destructive">*</span></label>
              <Input 
                placeholder="e.g. 0123456789" 
                maxLength={10} 
                value={formData.accountNumber} 
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, "");
                  setFormData({ ...formData, accountNumber: val });
                }} 
              />
              {errors.accountNumber && <p className="text-xs text-destructive">{errors.accountNumber}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium">Account Name <span className="text-destructive">*</span></label>
              <Input 
                placeholder="The name on the bank account" 
                value={formData.accountName} 
                onChange={e => setFormData({ ...formData, accountName: e.target.value })} 
              />
              {errors.accountName && <p className="text-xs text-destructive">{errors.accountName}</p>}
            </div>
          </div>
        </section>

        <div className="pt-6 border-t flex justify-end">
          <Button type="submit" size="lg" disabled={!isValid || isSubmitting} style={{ backgroundColor: "#1A7A4A", color: "white" }} className="w-full sm:w-auto font-semibold px-8 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? "Submitting..." : "Submit Event"}
          </Button>
        </div>
      </form>

      {/* Terms & Conditions Modal */}
      <Dialog open={showTermsModal} onOpenChange={setShowTermsModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2 bg-white">
            <DialogTitle className="text-2xl font-extrabold text-[#1A7A4A] flex items-center gap-2">
              <Check className="w-6 h-6 border-2 border-[#1A7A4A] rounded-full p-0.5" />
              Tixora Organizer Agreement
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            <div className="space-y-6 text-sm text-muted-foreground leading-relaxed pr-4">
              <div className="space-y-4">
                <p className="font-semibold text-foreground text-base">Welcome to Tixora!</p>
                <p>
                  Before you publish your event, please review and agree to the following organizer guidelines. 
                  These terms ensure a safe and trustworthy experience for all Tixora users.
                </p>
              </div>

              <div className="space-y-4">
                <section>
                  <h4 className="font-bold text-foreground mb-1">1. Accuracy of Event Details</h4>
                  <p>The organizer is solely responsible for ensuring the accuracy of all event information provided, including date, time, venue, and ticket tier descriptions.</p>
                </section>

                <section>
                  <h4 className="font-bold text-foreground mb-1">2. Liability & Cancellations</h4>
                  <p>Tixora takes no liability for cancelled, rescheduled, or fraudulent events. Organizers are responsible for managing refunds and attendee communications in such cases.</p>
                </section>

                <section>
                  <h4 className="font-bold text-foreground mb-1">3. Payout Policy</h4>
                  <p>Payouts from ticket sales are subject to Tixora's official payout policy. Standard payouts occur after successful event verification or as specified in your organizer dashboard.</p>
                </section>

                <section>
                  <h4 className="font-bold text-foreground mb-1">4. Prohibited Content</h4>
                  <p>Illegal events, fraudulent listings, or content that promotes hate speech, violence, or discrimination are strictly prohibited on Tixora.</p>
                </section>

                <section>
                  <h4 className="font-bold text-foreground mb-1">5. Policy Enforcement</h4>
                  <p>Tixora reserves the right to remove any event, suspend organizer accounts, or withhold funds for events that violate these policies or our general Terms of Service.</p>
                </section>

                <section>
                  <h4 className="font-bold text-foreground mb-1">6. Terms of Service</h4>
                  <p>
                    By creating an event, you acknowledge that you have read and agree to Tixora's full Terms of Service 
                    available at <a href="https://tixoraafrica.com.ng/terms" target="_blank" rel="noopener noreferrer" className="text-[#1A7A4A] font-semibold underline">tixoraafrica.com.ng/terms</a>.
                  </p>
                </section>
              </div>

              <p className="pt-4 border-t text-xs italic">Version 1.0 (Organizers)</p>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 bg-muted/30 border-t flex-col sm:flex-row gap-4 sm:items-center">
            <div className="flex items-center space-x-3 flex-1 mb-2 sm:mb-0">
              <Checkbox 
                id="terms" 
                checked={termsAccepted} 
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                className="h-5 w-5 border-2 border-[#1A7A4A] data-[state=checked]:bg-[#1A7A4A] data-[state=checked]:text-white"
              />
              <Label htmlFor="terms" className="text-sm font-medium cursor-pointer select-none text-foreground">
                I have read and agree to the Tixora Organizer Agreement
              </Label>
            </div>
            
            <div className="flex gap-3 w-full sm:w-auto">
              <Button 
                variant="outline" 
                className="flex-1 sm:flex-none border-[#1A7A4A] text-[#1A7A4A] hover:bg-[#1A7A4A]/5"
                onClick={() => setShowTermsModal(false)}
              >
                I Disagree
              </Button>
              <Button 
                className="flex-1 sm:flex-none bg-[#1A7A4A] text-white hover:brightness-110 disabled:opacity-50 disabled:grayscale transition-all"
                disabled={!termsAccepted || isSubmitting}
                onClick={handleAgreeTerms}
              >
                {isSubmitting ? "Processing..." : "I Agree"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

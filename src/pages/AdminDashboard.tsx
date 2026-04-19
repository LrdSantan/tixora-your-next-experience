import { useState, useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { fetchEvents } from "@/lib/events";
import type { Event } from "@/lib/mock-data";
import { formatPrice, formatDate } from "@/lib/mock-data";
import { Skeleton } from "@/components/ui/skeleton";
import { EditCoverImageButton } from "@/components/EditCoverImageButton";

import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { 
  Trash2, Plus, Users, Landmark, Ticket, Calendar, 
  PlayCircle, PauseCircle, Tag, CheckCircle2, AlertCircle,
  Filter, Search, Wallet, FileText
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Transaction = {
  id: string;
  buyer_email: string;
  event_title: string;
  tier_name: string;
  quantity: number;
  amount_paid: number;
  created_at: string;
};

type Coupon = {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string;
  author: string;
  published: boolean;
  published_at: string | null;
  created_at: string;
};

const BRAND_GREEN = "#1a7a4a";

function AdminAddBlogModal({ onAdded, editPost }: { onAdded: () => void, editPost?: BlogPost }) {
  const [open, setOpen] = useState(false);
  const supabase = getSupabaseClient();
  const [formData, setFormData] = useState({
    title: "", excerpt: "", content: "", cover_image_url: "", published: false, author: "Tixora Team"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editPost) {
      setFormData({
        title: editPost.title,
        excerpt: editPost.excerpt,
        content: editPost.content,
        cover_image_url: editPost.cover_image_url,
        published: editPost.published,
        author: editPost.author
      });
      setOpen(true);
    } else {
      setFormData({ title: "", excerpt: "", content: "", cover_image_url: "", published: false, author: "Tixora Team" });
    }
  }, [editPost]);

  const generateSlug = (title: string) => {
    return title.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (!formData.title || !formData.content) return toast.error("Title and content are required");

    try {
      setIsSubmitting(true);
      const slug = generateSlug(formData.title);
      
      const payload = {
        ...formData,
        slug,
        published_at: formData.published ? new Date().toISOString() : null
      };

      let error;
      if (editPost) {
        ({ error } = await supabase.from('blog_posts').update(payload).eq('id', editPost.id));
      } else {
        ({ error } = await supabase.from('blog_posts').insert(payload));
      }

      if (error) throw error;
      toast.success(editPost ? "Post updated!" : "Post created!");
      setOpen(false);
      onAdded();
    } catch (err: any) {
      toast.error(err.message || "Failed to save post");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!editPost && (
        <DialogTrigger asChild>
          <Button style={{ backgroundColor: BRAND_GREEN }}>
            <Plus className="w-4 h-4 mr-2" /> New Post
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editPost ? "Edit Post" : "Compose New Post"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Title</label>
            <Input required placeholder="Post Title" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
            {formData.title && (
              <p className="text-[10px] text-muted-foreground italic">Slug: {generateSlug(formData.title)}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Excerpt</label>
            <Input placeholder="Short summary for listing" value={formData.excerpt} onChange={e => setFormData({ ...formData, excerpt: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Cover Image URL</label>
            <Input placeholder="https://..." value={formData.cover_image_url} onChange={e => setFormData({ ...formData, cover_image_url: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Content (HTML/Markdown)</label>
            <Textarea required className="min-h-[200px]" placeholder="Write your post here..." value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} />
          </div>
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
            <div className="space-y-0.5">
              <label className="text-sm font-semibold">Publish Immediately</label>
              <p className="text-xs text-muted-foreground">Make this post visible to everyone on /blog</p>
            </div>
            <Switch checked={formData.published} onCheckedChange={v => setFormData({ ...formData, published: v })} />
          </div>
          <Button type="submit" className="w-full h-12 text-lg" disabled={isSubmitting} style={{ backgroundColor: BRAND_GREEN }}>
            {isSubmitting ? "Saving..." : (editPost ? "Update Post" : "Publish Post")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdminAddCouponModal({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const supabase = getSupabaseClient();
  const [formData, setFormData] = useState({
    code: "", discount_type: "percentage" as "percentage" | "fixed", discount_value: "", max_uses: "", expires_at: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return toast.error("Database connection missing.");
    if (!formData.code || !formData.discount_value) return toast.error("Code and value are required");
    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('coupons').insert({
        code: formData.code.toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: Number(formData.discount_value),
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        expires_at: formData.expires_at || null,
        is_active: true
      });
      if (error) throw error;
      toast.success("Coupon created successfully!");
      setOpen(false);
      onAdded();
    } catch (err: any) {
      toast.error(err.message || "Failed to create coupon");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button style={{ backgroundColor: BRAND_GREEN }}>
          <Plus className="w-4 h-4 mr-2" /> Add Coupon
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create New Coupon</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input required placeholder="CODE (e.g. SUMMER20)" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} />
          <Select value={formData.discount_type} onValueChange={(val: any) => setFormData({ ...formData, discount_type: val })}>
            <SelectTrigger><SelectValue placeholder="Discount Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="fixed">Fixed Amount (₦)</SelectItem>
            </SelectContent>
          </Select>
          <Input required type="number" min="1" placeholder="Discount Value" value={formData.discount_value} onChange={e => setFormData({ ...formData, discount_value: e.target.value })} />
          <Input type="number" min="1" placeholder="Max uses (leave blank for unlimited)" value={formData.max_uses} onChange={e => setFormData({ ...formData, max_uses: e.target.value })} />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Expiry Date (Optional)</label>
            <Input type="date" value={formData.expires_at} onChange={e => setFormData({ ...formData, expires_at: e.target.value })} />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting} style={{ backgroundColor: BRAND_GREEN }}>{isSubmitting ? "Creating..." : "Create Coupon"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdminPayoutDetailsModal({ event }: { event: Event }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-primary/10" title="Payout Details">
          <Landmark className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payout Details: {event.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-3 gap-4 border-b pb-2">
            <span className="text-sm font-semibold text-muted-foreground">Bank Name</span>
            <span className="text-sm font-medium col-span-2">{event.bank_name || "Not provided"}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 border-b pb-2">
            <span className="text-sm font-semibold text-muted-foreground">Account Number</span>
            <span className="text-sm font-medium col-span-2 text-primary font-mono" style={{ color: BRAND_GREEN }}>{event.account_number || "Not provided"}</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <span className="text-sm font-semibold text-muted-foreground">Account Name</span>
            <span className="text-sm font-medium col-span-2">{event.account_name || "Not provided"}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdminSendInvoiceModal({ event, stats }: { event: Event; stats: { revenue: number; tickets_sold: number } }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(event.organizer_email || "");
  const [isSending, setIsSending] = useState(false);
  const supabase = getSupabaseClient();

  const handleSendInvoice = async () => {
    if (!supabase) return;
    if (!email) {
      toast.error("Recipient email is required");
      return;
    }

    try {
      setIsSending(true);
      const { data, error } = await supabase.functions.invoke('send-invoice-email', {
        body: { event_id: event.id, recipient_email: email }
      });

      if (error) throw error;
      
      if (data?.ok === false) {
        throw new Error(data.error || "Failed to send invoice");
      }

      toast.success(`Invoice for "${event.title}" sent to ${email}`);
      setOpen(false);
    } catch (err: any) {
      console.error("[SendInvoice Error]", err);
      toast.error(err.message || "Failed to send invoice");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5" title="Send Invoice">
          <FileText className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Revenue Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="bg-muted/30 p-4 rounded-xl space-y-2 border border-border">
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Event Summary</p>
            <div className="flex justify-between items-end gap-4">
              <div className="flex-1">
                <h4 className="font-bold text-base leading-tight line-clamp-1">{event.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(event.date)} · {event.city}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-black text-primary" style={{ color: BRAND_GREEN }}>{formatPrice(stats.revenue / 100)}</p>
                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Gross Collected</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-foreground">Recipient Email</label>
            <Input 
              type="email" 
              placeholder="organizer@example.com" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="h-11 rounded-xl focus-visible:ring-primary"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">The professional HTML invoice will be sent to this address. Defaults to organizer's registered email.</p>
          </div>

          <Button 
            onClick={handleSendInvoice} 
            disabled={isSending} 
            className="w-full h-12 text-base font-bold shadow-sm transition-all active:scale-[0.98]" 
            style={{ backgroundColor: BRAND_GREEN }}
          >
            {isSending ? "Generating & Sending..." : "Send Invoice Now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const supabase = getSupabaseClient();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ticketsData, setTicketsData] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [editingPost, setEditingPost] = useState<BlogPost | undefined>();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [payoutFilter, setPayoutFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [searchQuery, setSearchQuery] = useState("");

  const handleCleanupTickets = async () => {
    if (!supabase) return;
    if (!window.confirm("This will permanently delete all tickets that were used more than 24 hours ago. Are you sure?")) return;
    
    setIsCleaningUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-used-tickets');
      if (error) throw error;
      toast.success(`${data?.deleted || 0} used tickets deleted successfully`);
    } catch (err: any) {
      toast.error(err.message || "Failed to cleanup tickets");
    } finally {
      setIsCleaningUp(false);
    }
  };

  const loadData = async () => {
    if (!supabase) return;
    try {
      const allEvents = await fetchEvents(false);
      setEvents(allEvents);

      const { data: txData, error: txError } = await supabase.rpc("get_recent_transactions");
      if (!txError && txData) setTransactions(txData);

      const { data: tData, error: tError } = await supabase.from('tickets').select('amount_paid, quantity, event_id');
      if (!tError && tData) setTicketsData(tData);

      const { data: cData, error: cError } = await supabase.from('coupons').select('id, code, discount_type, discount_value, max_uses, uses_count, expires_at, is_active').order('created_at', { ascending: false });
      if (!cError && cData) setCoupons(cData);

      const { data: bData, error: bError } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
      if (!bError && bData) setBlogPosts(bData);
    } catch (err) {
      console.error("Admin load error:", err);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (!loading && user?.email === 'yusufquadir50@gmail.com') {
      loadData();
    } else if (!loading) {
      setIsInitializing(false);
    }
  }, [user, loading, supabase]);

  const { totalTicketsSold, totalRevenue, eventStats, totalUnpaidRevenue } = useMemo(() => {
    let sold = 0;
    let rev = 0;
    let unpaidRev = 0;
    const map: Record<string, { tickets_sold: number; revenue: number }> = {};

    ticketsData.forEach(t => {
      sold += t.quantity;
      rev += t.amount_paid;
      const eventId = t.event_id;
      if (!map[eventId]) {
        map[eventId] = { tickets_sold: 0, revenue: 0 };
      }
      map[eventId].tickets_sold += t.quantity;
      map[eventId].revenue += t.amount_paid;
    });

    // Calculate unpaid revenue
    events.forEach(e => {
      if (e.payout_status === 'unpaid') {
        unpaidRev += (map[e.id]?.revenue || 0);
      }
    });

    return {
      totalTicketsSold: sold,
      totalRevenue: rev,
      eventStats: map,
      totalUnpaidRevenue: unpaidRev
    };
  }, [ticketsData, events]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchesPayout = payoutFilter === 'all' || e.payout_status === payoutFilter;
      const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            e.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPayout && matchesSearch;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [events, payoutFilter, searchQuery]);

  const updatePayoutStatus = async (eventId: string, status: string) => {
    if (!supabase) return;
    if (status === 'paid' && !window.confirm("Mark this event as paid? This should only be done after successful bank transfer.")) return;
    
    try {
      const { error } = await supabase.from('events').update({ payout_status: status }).eq('id', eventId);
      if (error) throw error;
      toast.success(`Payout status updated to ${status}`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update payout status");
    }
  };

  const updateEventStatus = async (id: string, status: 'active' | 'suspended') => {
    if (!supabase) return;
    const { error } = await supabase.from('events').update({ status }).eq('id', id);
    if (error) {
      toast.error(`Failed to ${status} event`);
      return;
    }
    toast.success(`Event ${status}`);
    loadData();
  };

  const deleteEvent = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm("Are you sure you want to delete this event? This action cannot be undone.")) return;
    const { error } = await supabase.from('events').update({ status: 'deleted' }).eq('id', id);
    if (error) toast.error("Failed to delete event");
    else {
      toast.success("Event removed");
      loadData();
    }
  };

  const toggleCoupon = async (id: string, currentStatus: boolean) => {
    if (!supabase) return;
    const { error } = await supabase.from('coupons').update({ is_active: !currentStatus }).eq('id', id);
    if (error) toast.error("Failed to toggle coupon");
    else loadData();
  };

  const deleteCoupon = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm("Delete this coupon?")) return;
    const { error } = await supabase.from('coupons').delete().eq('id', id);
    if (error) toast.error("Failed to delete coupon");
    else loadData();
  };

  const deleteBlogPost = async (id: string) => {
    if (!supabase) return;
    if (!window.confirm("Delete this blog post?")) return;
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    if (error) toast.error("Failed to delete post");
    else {
      toast.success("Post deleted");
      loadData();
    }
  };

  if (loading || isInitializing) return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <Skeleton className="h-9 w-52 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-card p-6 rounded-2xl border shadow-sm space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="bg-card rounded-2xl border overflow-hidden">
        {[1,2,3,4].map(i => (
          <div key={i} className="p-4 flex items-center justify-between gap-4 border-b last:border-0">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
  if (!user || user.email !== 'yusufquadir50@gmail.com') return <Navigate to="/" replace />;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Comprehensive overview of platform activity and finances.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="outline" className="text-muted-foreground hover:text-destructive border-dashed" onClick={handleCleanupTickets} disabled={isCleaningUp}>
            <Trash2 className="w-4 h-4 mr-2" />
            {isCleaningUp ? "Cleaning..." : "Cleanup Used Tickets"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card p-6 rounded-2xl border shadow-sm flex flex-col gap-2 group hover:border-primary/50 transition-colors">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Total Revenue</h3>
            <div className="p-2 bg-primary/10 rounded-lg"><Landmark className="w-4 h-4 text-primary" /></div>
          </div>
          <p className="text-3xl font-black">{formatPrice(totalRevenue / 100)}</p>
          <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Gross Platform Earnings</div>
        </div>
        
        <div className="bg-card p-6 rounded-2xl border shadow-sm flex flex-col gap-2 group hover:border-primary/50 transition-colors">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Total Events</h3>
            <div className="p-2 bg-primary/10 rounded-lg"><Calendar className="w-4 h-4 text-primary" /></div>
          </div>
          <p className="text-3xl font-black">{events.length}</p>
          <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">{events.filter(e => e.status === 'active').length} Active Listings</div>
        </div>

        <div className="bg-card p-6 rounded-2xl border shadow-sm flex flex-col gap-2 group hover:border-primary/50 transition-colors">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Tickets Sold</h3>
            <div className="p-2 bg-primary/10 rounded-lg"><Ticket className="w-4 h-4 text-primary" /></div>
          </div>
          <p className="text-3xl font-black">{totalTicketsSold.toLocaleString()}</p>
          <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Platform-wide volume</div>
        </div>

        <div className="bg-card p-6 rounded-2xl border shadow-sm flex flex-col gap-2 group border-amber-200 bg-amber-50/10">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm text-amber-700 uppercase tracking-wider">Unpaid Payouts</h3>
            <div className="p-2 bg-amber-100 rounded-lg"><Wallet className="w-4 h-4 text-amber-600" /></div>
          </div>
          <p className="text-3xl font-black text-amber-600">{formatPrice(totalUnpaidRevenue / 100)}</p>
          <div className="text-[10px] text-amber-700/60 font-medium uppercase tracking-tighter">Pending organizer payments</div>
        </div>
      </div>

      <Tabs defaultValue="events" className="w-full">
        <TabsList className="mb-6 h-12 p-1 bg-muted/60 rounded-xl w-full justify-start overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="events" className="rounded-lg px-6 h-full font-bold">Event Management</TabsTrigger>
          <TabsTrigger value="coupons" className="rounded-lg px-6 h-full font-bold">Coupons</TabsTrigger>
          <TabsTrigger value="blog" className="rounded-lg px-6 h-full font-bold">Blog Feed</TabsTrigger>
          <TabsTrigger value="txs" className="rounded-lg px-6 h-full font-bold">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-card p-4 rounded-2xl border shadow-sm">
            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl w-full md:w-auto">
              <Button 
                variant={payoutFilter === 'all' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setPayoutFilter('all')}
                className="rounded-lg flex-1 md:flex-none h-9 font-bold"
                style={payoutFilter === 'all' ? { backgroundColor: BRAND_GREEN } : {}}
              >
                All Events
              </Button>
              <Button 
                variant={payoutFilter === 'unpaid' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setPayoutFilter('unpaid')}
                className="rounded-lg flex-1 md:flex-none h-9 font-bold"
                style={payoutFilter === 'unpaid' ? { backgroundColor: BRAND_GREEN } : {}}
              >
                Unpaid
              </Button>
              <Button 
                variant={payoutFilter === 'paid' ? 'default' : 'ghost'} 
                size="sm" 
                onClick={() => setPayoutFilter('paid')}
                className="rounded-lg flex-1 md:flex-none h-9 font-bold"
                style={payoutFilter === 'paid' ? { backgroundColor: BRAND_GREEN } : {}}
              >
                Paid
              </Button>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search event title or ID..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl"
              />
            </div>
          </div>

          <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-bold uppercase text-xs tracking-widest px-6 py-4">Event Details</TableHead>
                  <TableHead className="font-bold uppercase text-xs tracking-widest">Date</TableHead>
                  <TableHead className="font-bold uppercase text-xs tracking-widest text-center">Tickets Sold</TableHead>
                  <TableHead className="font-bold uppercase text-xs tracking-widest text-right">Revenue</TableHead>
                  <TableHead className="font-bold uppercase text-xs tracking-widest text-center px-6">Payout Status</TableHead>
                  <TableHead className="text-right px-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-60 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="w-10 h-10 opacity-20" />
                        <p className="font-medium text-lg">No events found matching your criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map(e => {
                    const stats = eventStats[e.id] || { tickets_sold: 0, revenue: 0 };
                    return (
                      <TableRow key={e.id} className="group hover:bg-muted/30 transition-colors">
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-base leading-tight">{e.title}</span>
                            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-tighter">{e.id}</span>
                            <div className="flex items-center gap-1.5 mt-1">
                               <Badge variant="secondary" className={e.status === 'active' ? 'bg-green-100 text-green-700 h-5 text-[10px]' : 'bg-amber-100 text-amber-700 h-5 text-[10px]'}>
                                {e.status}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground font-medium uppercase">{e.category}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{formatDate(e.date)}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">{e.city}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center gap-1 bg-primary/5 px-2.5 py-1 rounded-full text-xs font-black text-primary">
                            <Ticket className="w-3 h-3" />
                            {stats.tickets_sold}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-black text-base">{formatPrice(stats.revenue / 100)}</div>
                        </TableCell>
                        <TableCell className="text-center px-6">
                          {e.payout_status === 'paid' ? (
                            <Badge className="bg-green-100 text-green-700 border-0 flex items-center gap-1.5 w-fit mx-auto h-8 px-4 font-black uppercase text-[10px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Paid
                            </Badge>
                          ) : (
                            <Button 
                              size="sm" 
                              onClick={() => updatePayoutStatus(e.id, 'paid')}
                              className="bg-gray-100 text-gray-600 hover:bg-green-600 hover:text-white transition-all h-8 px-4 rounded-lg font-black uppercase text-[10px] gap-1.5 flex items-center mx-auto"
                            >
                              <Landmark className="w-3.5 h-3.5" />
                              Mark Paid
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <div className="flex items-center justify-end gap-1">
                            {e.status === 'active' ? (
                              <Button variant="ghost" size="icon" onClick={() => updateEventStatus(e.id, 'suspended')} className="h-9 w-9 text-amber-600 hover:bg-amber-50" title="Suspend">
                                <PauseCircle className="w-5 h-5" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" onClick={() => updateEventStatus(e.id, 'active')} className="h-9 w-9 text-green-600 hover:bg-green-50" title="Unsuspend">
                                <PlayCircle className="w-5 h-5" />
                              </Button>
                            )}
                            <EditCoverImageButton 
                              eventId={e.id} 
                              onSuccess={loadData}
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5"
                            />
                            <AdminPayoutDetailsModal event={e} />
                            <AdminSendInvoiceModal event={e} stats={stats} />
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/5" onClick={() => deleteEvent(e.id)}>
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="coupons" className="space-y-4">
          <div className="flex justify-between items-center bg-card p-4 rounded-2xl border shadow-sm">
             <h3 className="font-bold text-lg text-foreground px-2">{coupons.length} Active Coupons</h3>
             <AdminAddCouponModal onAdded={loadData} />
          </div>
          <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
            {coupons.length === 0 ? (
              <div className="p-20 text-center text-muted-foreground">
                <Tag className="w-12 h-12 mx-auto mb-4 opacity-10" />
                <p>No coupons found. Create your first discount code!</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="px-6 py-4 font-bold uppercase text-xs tracking-widest">Code</TableHead>
                    <TableHead className="font-bold uppercase text-xs tracking-widest text-center">Discount</TableHead>
                    <TableHead className="font-bold uppercase text-xs tracking-widest text-center">Usage</TableHead>
                    <TableHead className="font-bold uppercase text-xs tracking-widest">Expiry</TableHead>
                    <TableHead className="font-bold uppercase text-xs tracking-widest text-center">Status</TableHead>
                    <TableHead className="text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map(c => (
                    <tr key={c.id} className={`group hover:bg-muted/30 transition-colors ${!c.is_active ? "opacity-60" : ""}`}>
                      <td className="px-6 py-4 font-black text-primary text-base" style={{ color: BRAND_GREEN }}>{c.code}</td>
                      <td className="text-center font-bold">
                        {c.discount_type === 'percentage' ? `${c.discount_value}%` : formatPrice(c.discount_value)}
                      </td>
                      <td className="text-center text-sm font-medium">
                        <span className="text-foreground">{c.uses_count}</span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="text-muted-foreground">{c.max_uses || '∞'}</span>
                      </td>
                      <td className="text-sm">
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="text-center">
                        <Switch checked={c.is_active} onCheckedChange={() => toggleCoupon(c.id, c.is_active)} className="scale-75" />
                      </td>
                      <td className="text-right px-6">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-9 w-9" onClick={() => deleteCoupon(c.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="blog" className="space-y-4">
          <div className="flex justify-between items-center bg-card p-4 rounded-2xl border shadow-sm">
            <h3 className="font-bold text-lg text-foreground px-2">{blogPosts.length} Editorial Posts</h3>
            <AdminAddBlogModal onAdded={loadData} editPost={editingPost} />
          </div>
          <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
            {blogPosts.length === 0 ? (
              <div className="p-20 text-center text-muted-foreground">No posts found.</div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="px-6 py-4 font-bold uppercase text-xs tracking-widest">Title</TableHead>
                    <TableHead className="font-bold uppercase text-xs tracking-widest">Author</TableHead>
                    <TableHead className="font-bold uppercase text-xs tracking-widest">Status</TableHead>
                    <TableHead className="font-bold uppercase text-xs tracking-widest">Date</TableHead>
                    <TableHead className="text-right px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blogPosts.map(post => (
                    <TableRow key={post.id} className="group hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-bold max-w-xs">{post.title}</td>
                      <td className="text-sm font-medium">{post.author}</td>
                      <td>
                        <Badge variant="outline" className={post.published ? "bg-green-50 text-green-700 border-green-200" : "bg-neutral-50 text-neutral-600"}>
                          {post.published ? 'Live' : 'Draft'}
                        </Badge>
                      </td>
                      <td className="text-sm text-muted-foreground">
                        {formatDate(post.created_at)}
                      </td>
                      <td className="text-right px-6 space-x-1">
                        <Button variant="ghost" size="sm" className="h-9 font-bold text-primary" onClick={() => setEditingPost(post)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => deleteBlogPost(post.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="txs" className="space-y-4">
          <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
            {transactions.length === 0 ? (
              <div className="p-20 text-center text-muted-foreground">No recent transactions found.</div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="px-6 py-4 font-bold uppercase text-xs tracking-widest">Buyer</TableHead>
                    <TableHead className="font-bold uppercase text-xs tracking-widest">Event & Tier</TableHead>
                    <TableHead className="font-bold uppercase text-xs tracking-widest text-center">QTY</TableHead>
                    <TableHead className="font-bold uppercase text-xs tracking-widest text-right">Amount</TableHead>
                    <TableHead className="text-right px-6 font-bold uppercase text-xs tracking-widest">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(tx => (
                    <TableRow key={tx.id} className="group hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold">{tx.buyer_email || 'Anonymous'}</div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">{tx.id}</div>
                      </td>
                      <td>
                        <div className="font-bold">{tx.event_title}</div>
                        <div className="text-xs text-muted-foreground">{tx.tier_name}</div>
                      </td>
                      <td className="text-center font-black">{tx.quantity}</td>
                      <td className="text-right">
                        <div className="font-black text-base">{formatPrice(tx.amount_paid / 100)}</div>
                      </td>
                      <td className="text-right px-6">
                        <div className="text-sm font-medium">{new Date(tx.created_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      <div className="mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-muted-foreground text-sm">
        <p>© 2026 Tixora • Master Control Interface</p>
        <div className="flex items-center gap-4">
          <button className="hover:text-primary transition-colors">Documentation</button>
          <button className="hover:text-primary transition-colors">Support</button>
          <button className="hover:text-primary transition-colors">API Status</button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { fetchEvents } from "@/lib/events";
import type { Event } from "@/lib/mock-data";
import { formatPrice, formatDate } from "@/lib/mock-data";
import { CATEGORIES } from "@/lib/mock-data";
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
import { Upload, Trash2, Plus, Users, Landmark, Ticket, Calendar, PlayCircle, PauseCircle, Tag } from "lucide-react";

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
          <Button className="bg-primary">
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
          <Button type="submit" className="w-full h-12 text-lg" disabled={isSubmitting}>
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
        <Button style={{ backgroundColor: "#1A7A4A" }}>
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Coupon"}</Button>
        </form>
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

      const { data: tData, error: tError } = await supabase.from('tickets').select('amount_paid, quantity, events(id, title)');
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

  const activeSuspendEvents = useMemo(() => events.filter(e => e.status !== 'expired' && e.status !== 'deleted'), [events]);
  const expiredEvents = useMemo(() => events.filter(e => e.status === 'expired'), [events]);
  
  const { totalTicketsSold, totalRevenue, revenueByEvent } = useMemo(() => {
    let sold = 0;
    let rev = 0;
    const map: Record<string, { event_title: string; revenue: number }> = {};

    ticketsData.forEach(t => {
      sold += t.quantity;
      rev += t.amount_paid;
      const eventTitle = t.events?.title || 'Unknown Event';
      const eventId = t.events?.id || 'unknown';
      if (!map[eventId]) {
        map[eventId] = { event_title: eventTitle, revenue: 0 };
      }
      map[eventId].revenue += t.amount_paid;
    });

    return {
      totalTicketsSold: sold,
      totalRevenue: rev,
      revenueByEvent: Object.values(map).sort((a, b) => b.revenue - a.revenue)
    };
  }, [ticketsData]);

  if (loading || isInitializing) return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage events, approve requests, and view revenue.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card p-6 rounded-2xl border shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <h3 className="font-medium text-sm text-foreground">Total Tickets Sold</h3>
            <Ticket className="w-4 h-4 text-primary" />
          </div>
          <p className="text-3xl font-bold">{totalTicketsSold.toLocaleString()}</p>
        </div>
        <div className="bg-card p-6 rounded-2xl border shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <h3 className="font-medium text-sm text-foreground">Total Revenue</h3>
            <Landmark className="w-4 h-4 text-primary" />
          </div>
          <p className="text-3xl font-bold">{formatPrice(totalRevenue / 100)}</p>
        </div>
        <div className="bg-card p-6 rounded-2xl border shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <h3 className="font-medium text-sm text-foreground">Active Listings</h3>
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <p className="text-3xl font-bold">{events.filter(e => e.status === 'active').length}</p>
        </div>
        <div className="bg-card p-6 rounded-2xl border shadow-sm flex flex-col gap-2">
          <div className="flex justify-between items-center text-muted-foreground">
            <h3 className="font-medium text-sm text-foreground">Total Coupons</h3>
            <Tag className="w-4 h-4 text-primary" />
          </div>
          <p className="text-3xl font-bold text-primary">{coupons.length}</p>
        </div>
      </div>

      <Tabs defaultValue="listings" className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-2 lg:grid-cols-5 bg-muted/60 p-1 rounded-xl h-auto flex-wrap">
          <TabsTrigger value="listings" className="rounded-lg py-2">Listings</TabsTrigger>
          <TabsTrigger value="expired" className="rounded-lg py-2">Expired</TabsTrigger>
          <TabsTrigger value="coupons" className="rounded-lg py-2">Coupons</TabsTrigger>
          <TabsTrigger value="blog" className="rounded-lg py-2">Blog</TabsTrigger>
          <TabsTrigger value="txs" className="rounded-lg py-2">Transactions</TabsTrigger>
          <TabsTrigger value="revenue" className="rounded-lg py-2">Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button variant="outline" className="text-muted-foreground hover:text-destructive border-dashed" onClick={handleCleanupTickets} disabled={isCleaningUp}>
              <Trash2 className="w-4 h-4 mr-2" />
              {isCleaningUp ? "Cleaning..." : "Delete Used Tickets"}
            </Button>
          </div>
          <div className="bg-card rounded-2xl border overflow-hidden">
            <div className="divide-y cursor-default">
              {activeSuspendEvents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No active or suspended events.</div>
              ) : (
                activeSuspendEvents.map(e => {
                  const totalTiers = e.ticket_tiers.reduce((sum, t) => sum + t.total_quantity, 0);
                  const remainingTiers = e.ticket_tiers.reduce((sum, t) => sum + t.remaining_quantity, 0);
                  const sold = totalTiers - remainingTiers;
                  
                  return (
                    <div key={e.id} className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-bold text-lg">{e.title}</h4>
                          <Badge variant="secondary" className={e.status === 'active' ? 'bg-green-100 text-green-700 capitalize' : 'bg-amber-100 text-amber-700 capitalize'}>
                            {e.status === 'active' ? 'Active' : 'Suspended'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{e.category} • {formatDate(e.date)}</p>
                      </div>
                      <div className="text-right text-sm text-muted-foreground px-4">
                        <p><span className="font-semibold text-foreground">{sold}</span> sold</p>
                        <p><span className="font-semibold">{remainingTiers}</span> left</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {e.status === 'active' ? (
                           <Button variant="outline" size="sm" onClick={() => updateEventStatus(e.id, 'suspended')} className="text-amber-600 border-amber-200">
                             <PauseCircle className="w-4 h-4 mr-1.5" /> Suspend
                           </Button>
                        ) : (
                           <Button variant="outline" size="sm" onClick={() => updateEventStatus(e.id, 'active')} className="text-green-600 border-green-200">
                             <PlayCircle className="w-4 h-4 mr-1.5" /> Unsuspend
                           </Button>
                        )}
                        <EditCoverImageButton 
                          eventId={e.id} 
                          onSuccess={loadData}
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                        />
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteEvent(e.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="expired" className="space-y-4">
          <div className="bg-card rounded-2xl border overflow-hidden">
            {expiredEvents.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No expired events.</div>
            ) : (
              <div className="divide-y cursor-default">
                {expiredEvents.map(e => (
                  <div key={e.id} className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-bold text-lg text-muted-foreground">{e.title}</h4>
                        <Badge variant="secondary" className="bg-neutral-200 text-neutral-600">Expired</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{e.category} • {formatDate(e.date)}</p>
                    </div>
                    <div>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => deleteEvent(e.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="coupons" className="space-y-4">
          <div className="flex justify-end mb-4">
            <AdminAddCouponModal onAdded={loadData} />
          </div>
          <div className="bg-card rounded-2xl border overflow-hidden">
            {coupons.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No coupons created yet.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4">Code</th>
                    <th className="px-6 py-4">Discount</th>
                    <th className="px-6 py-4">Uses</th>
                    <th className="px-6 py-4">Expiry</th>
                    <th className="px-6 py-4 text-center">Active</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {coupons.map(c => (
                    <tr key={c.id} className={!c.is_active ? "bg-muted/20 text-muted-foreground" : ""}>
                      <td className="px-6 py-4 font-bold">{c.code}</td>
                      <td className="px-6 py-4 font-medium">
                        {c.discount_type === 'percentage' ? `${c.discount_value}%` : formatPrice(c.discount_value)}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {c.uses_count} {c.max_uses ? `/ ${c.max_uses}` : '(unlimited)'}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Switch checked={c.is_active} onCheckedChange={() => toggleCoupon(c.id, c.is_active)} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => deleteCoupon(c.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="blog" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">{blogPosts.length} posts total</p>
            <AdminAddBlogModal onAdded={loadData} editPost={editingPost} />
          </div>
          <div className="bg-card rounded-2xl border overflow-hidden">
            {blogPosts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No blog posts yet.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Author</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {blogPosts.map(post => (
                    <tr key={post.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-bold max-w-xs truncate">{post.title}</td>
                      <td className="px-6 py-4 text-muted-foreground">{post.author}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={post.published ? "bg-green-50 text-green-700 border-green-200" : "bg-neutral-50 text-neutral-600"}>
                          {post.published ? 'Published' : 'Draft'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {formatDate(post.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1">
                        <Button variant="ghost" size="sm" className="h-8 text-primary" onClick={() => setEditingPost(post)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteBlogPost(post.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="txs" className="space-y-4">
          <div className="bg-card rounded-2xl border overflow-x-auto">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No recent transactions.</div>
            ) : (
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4">Buyer Email</th>
                    <th className="px-6 py-4">Event</th>
                    <th className="px-6 py-4">Tier & QTY</th>
                    <th className="px-6 py-4">Amount Paid</th>
                    <th className="px-6 py-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-muted/20">
                      <td className="px-6 py-4 font-medium">{tx.buyer_email || 'Unknown'}</td>
                      <td className="px-6 py-4">{tx.event_title}</td>
                      <td className="px-6 py-4">{tx.tier_name} <br/> <span className="text-muted-foreground text-xs">Qty: {tx.quantity}</span></td>
                      <td className="px-6 py-4 font-bold">{formatPrice(tx.amount_paid / 100)}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground line-clamp-2">
                        {new Date(tx.created_at).toLocaleDateString()}<br/>
                        {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="bg-card rounded-2xl border overflow-hidden">
            {revenueByEvent.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No revenue data.</div>
            ) : (
              <div className="divide-y">
                {revenueByEvent.map((rev, idx) => (
                  <div key={idx} className="p-5 flex justify-between items-center">
                    <span className="font-medium text-lg">{rev.event_title}</span>
                    <span className="font-extrabold text-xl text-primary">{formatPrice(rev.revenue / 100)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}

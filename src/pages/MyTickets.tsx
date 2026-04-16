import { useState } from "react";
import { Ticket, Search, X, Copy, Check, ExternalLink, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { TicketDownloadBlock } from "@/components/TicketDownloadBlock";
import type { TicketVisualModel } from "@/components/TicketVisualCard";
import { TicketVisualCardSkeleton } from "@/components/TicketVisualCardSkeleton";
import { isEventDatePassed } from "@/lib/ticket-utils";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

type TicketRow = {
  id: string;
  reference: string;
  ticket_code: string | null;
  amount_paid: number;
  quantity: number;
  is_used: boolean;
  used_at: string | null;
  created_at: string;
  qr_token: string | null;
  resell_status: string | null;
  transfer_status: string | null;
  transfer_token: string | null;
  events: {
    title: string;
    date: string;
    time: string;
    venue: string;
    city: string;
  } | null;
  ticket_tiers: { name: string } | null;
};

function rowToModel(row: TicketRow, buyerName: string, buyerEmail: string): TicketVisualModel & { resell_status: string | null; transfer_status: string | null; transfer_token: string | null } {
  const ev = row.events;
  return {
    reference: row.reference,
    ticketCode: row.ticket_code ?? undefined,
    qrToken: row.qr_token ?? undefined,
    eventTitle: ev?.title ?? "Event",
    eventDate: ev?.date ? String(ev.date) : "",
    eventTime: ev?.time ?? "",
    venue: ev?.venue ?? "",
    city: ev?.city ?? "",
    tierName: row.ticket_tiers?.name ?? "Ticket",
    quantity: row.quantity,
    amountPaidKobo: row.amount_paid,
    buyerName,
    buyerEmail,
    purchasedAt: row.created_at,
    isUsed: row.is_used,
    usedAt: row.used_at,
    resell_status: row.resell_status,
    transfer_status: row.transfer_status,
    transfer_token: row.transfer_token,
  };
}

const MyTicketsPage = () => {
  const { user, session, loading } = useAuth();
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [clearing, setClearing] = useState(false);
  
  // Transfer Flow state
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [activeTransferLink, setActiveTransferLink] = useState("");
  const [transferEmail, setTransferEmail] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [isComingSoonModalOpen, setIsComingSoonModalOpen] = useState(false);

  const meta = user?.user_metadata as { full_name?: string } | undefined;
  const buyerName = meta?.full_name?.trim() || user?.email?.split("@")[0] || "Guest";
  const buyerEmail = user?.email ?? "";

  const query = useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: Boolean(user && supabase && isSupabaseConfigured),
    queryFn: async () => {
      if (!supabase || !user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("tickets")
        .select(
          `
          id,
          reference,
          ticket_code,
          amount_paid,
          quantity,
          is_used,
          used_at,
          created_at,
          qr_token,
          resell_status,
          transfer_status,
          transfer_token,
          events ( title, date, time, venue, city ),
          ticket_tiers ( name )
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as TicketRow[];
    },
  });

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8 animate-pulse">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-4 w-64 mb-8" />
        <div className="space-y-8">
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <Ticket className="mx-auto mb-4 h-16 w-16 rotate-[-30deg] text-primary" />
        <h1 className="mb-2 text-2xl font-bold text-foreground">Sign in to view your tickets</h1>
        <p className="mb-6 text-muted-foreground">You need to be logged in to see your booked tickets.</p>
        <Link to="/login">
          <Button className="bg-primary text-primary-foreground">Sign In</Button>
        </Link>
      </div>
    );
  }

  if (!isSupabaseConfigured || !supabase) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        <p>Supabase is not configured. Add credentials to load your tickets.</p>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-4 w-64 mb-8" />
        <div className="space-y-8">
          <TicketVisualCardSkeleton />
          <TicketVisualCardSkeleton />
          <TicketVisualCardSkeleton />
        </div>
      </div>
    );
  }

  if (query.isError) {
    const err = query.error as Error;
    return (
      <div className="container mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-destructive mb-2">Could not load tickets</p>
        <p className="text-sm text-muted-foreground">{err.message}</p>
      </div>
    );
  }

  const rows = query.data ?? [];
  const hasUsedOrExpired = rows.some((r) => r.is_used || isEventDatePassed(r.events?.date ? String(r.events.date) : ""));
  
  const filteredRows = rows.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const evTitle = r.events?.title?.toLowerCase() || "";
    const code = r.ticket_code?.toLowerCase() || "";
    const venue = r.events?.venue?.toLowerCase() || "";
    return evTitle.includes(q) || code.includes(q) || venue.includes(q);
  });

  const active = filteredRows.filter((r) => !isEventDatePassed(r.events?.date ? String(r.events.date) : ""));
  const expired = filteredRows.filter((r) => isEventDatePassed(r.events?.date ? String(r.events.date) : ""));

  const handleResell = (ticketId: string) => {
    setIsComingSoonModalOpen(true);
  };

  const handleCancelResell = async (ticketId: string) => {
    if (!supabase || !user) return;
    try {
      const token = session?.access_token;
      if (!token) {
        toast.error("Session expired. Please sign in again.");
        return;
      }

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${baseUrl}/functions/v1/cancel-resell`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ ticket_id: ticketId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      toast.success("Resell request cancelled. Ticket reactivated.");
      queryClient.invalidateQueries({ queryKey: ["my-tickets", user.id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel resell");
    }
  };

  const handleTransferInit = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setTransferEmail("");
    setIsInitiateModalOpen(true);
  };

  const handleConfirmTransfer = async () => {
    if (!supabase || !user || !selectedTicketId) return;
    
    setIsSubmittingTransfer(true);
    try {
      const token = session?.access_token;
      if (!token) {
        toast.error("Session expired. Please sign in again.");
        return;
      }

      const method = transferEmail.trim() ? 'email' : 'link';
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${baseUrl}/functions/v1/request-transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          ticket_id: selectedTicketId, 
          method: method, 
          ...(transferEmail.trim() ? { to_email: transferEmail.trim() } : {})
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const transferToken = result.data.transfer_token;
      const claimUrl = `${window.location.origin}/claim-ticket/${transferToken}`;
      
      setActiveTransferLink(claimUrl);
      setIsInitiateModalOpen(false);
      setIsTransferModalOpen(true);
      
      toast.success(method === 'email' 
        ? `Transfer initiated to ${transferEmail}. Link generated!` 
        : "Transfer link generated successfully!");
        
      queryClient.invalidateQueries({ queryKey: ["my-tickets", user.id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate transfer");
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const handleCopyLink = (link: string, id: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCancelTransfer = async (ticketId: string) => {
    if (!supabase || !user) return;
    try {
      const token = session?.access_token;
      if (!token) {
        toast.error("Session expired. Please sign in again.");
        return;
      }

      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${baseUrl}/functions/v1/cancel-transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ ticket_id: ticketId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      toast.success("Transfer cancelled. Ticket is yours again.");
      queryClient.invalidateQueries({ queryKey: ["my-tickets", user.id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel transfer");
    }
  };

  const handleClear = async () => {
    if (!supabase || !user) return;
    if (!window.confirm("This will remove all used and expired tickets from your list. Are you sure?")) return;
    
    setClearing(true);
    try {
      const ticketsToDelete = rows.filter((r) => r.is_used || isEventDatePassed(r.events?.date ? String(r.events.date) : ""));
      if (ticketsToDelete.length === 0) {
        toast.info("No used or expired tickets to clear.");
        setClearing(false);
        return;
      }
      
      const ids = ticketsToDelete.map(t => t.id);
      
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('user_id', user.id)
        .in('id', ids);
        
      if (error) throw error;
      
      toast.success("Your used and expired tickets have been cleared");
      queryClient.invalidateQueries({ queryKey: ["my-tickets", user.id] });
    } catch (err: any) {
      toast.error(err.message || "Failed to clear tickets");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">My Tickets</h1>
        {hasUsedOrExpired && (
          <Button variant="outline" size="sm" onClick={handleClear} disabled={clearing} className="w-full sm:w-auto text-muted-foreground hover:text-destructive border-dashed">
            {clearing ? "Clearing..." : "Clear Used & Expired"}
          </Button>
        )}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">Signed in as {user.email}</p>
      
      <div className="mb-8 rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
        <p>Used tickets are automatically removed after 24 hours.</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground">No tickets yet. Browse events to get started!</p>
      ) : (
        <div className="space-y-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by event, code, or venue..." 
              className="pl-9 pr-10" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:bg-transparent"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {filteredRows.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No tickets found matching "{searchQuery}"</p>
              <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2 text-primary">Clear search</Button>
            </div>
          ) : (
            <div className="space-y-12">
          {active.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-foreground">Active</h2>
              <div className="space-y-8">
                {active.map((row) => (
                  <div key={row.id} className="relative">
                    {/* Used/Active badge overlay */}
                    <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
                      {row.is_used ? (
                        <Badge className="bg-neutral-500 text-white border-0">
                          Used {row.used_at ? `· ${new Date(row.used_at).toLocaleDateString()}` : ""}
                        </Badge>
                      ) : row.resell_status === 'pending' ? (
                        <Badge className="bg-orange-500 text-white border-0">For Resell</Badge>
                      ) : row.transfer_status === 'pending' ? (
                        <Badge className="bg-blue-600 text-white border-0">Transfer Pending</Badge>
                      ) : (
                        <Badge className="bg-green-600 text-white border-0">Active</Badge>
                      )}
                    </div>
                    <TicketDownloadBlock model={rowToModel(row, buyerName, buyerEmail)} />
                    
                    {!row.is_used && !isEventDatePassed(row.events?.date ? String(row.events.date) : "") && (
                      <div className="mt-4 flex flex-wrap gap-2 justify-end px-4">
                        {row.resell_status === 'pending' ? (
                          <Button variant="outline" size="sm" onClick={() => handleCancelResell(row.id)} className="text-orange-600 border-orange-200">
                            Cancel Resell
                          </Button>
                        ) : row.transfer_status === 'pending' ? (
                          <div className="flex flex-wrap gap-2 justify-end w-full">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                const link = `${window.location.origin}/claim-ticket/${row.transfer_token}`;
                                handleCopyLink(link, row.id);
                              }}
                              className="flex items-center gap-1.5"
                            >
                              {copiedId === row.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5" />
                                  Copy Link
                                </>
                              )}
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50 flex items-center gap-1.5"
                              onClick={() => {
                                const link = `${window.location.origin}/claim-ticket/${row.transfer_token}`;
                                const waUrl = `https://wa.me/?text=${encodeURIComponent("Here's your ticket claim link: " + link)}`;
                                window.open(waUrl, '_blank');
                              }}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              WhatsApp
                            </Button>

                            <Button variant="outline" size="sm" onClick={() => handleCancelTransfer(row.id)} className="text-blue-600 border-blue-200">
                              Cancel Transfer
                            </Button>
                          </div>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handleResell(row.id)}>
                              Sell Ticket
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleTransferInit(row.id)}>
                              Transfer
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {expired.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-muted-foreground">Past events</h2>
              <div className="space-y-8 opacity-95">
                {expired.map((row) => (
                  <div key={row.id} className="relative">
                    <div className="absolute top-3 right-3 z-10">
                      {row.is_used ? (
                        <Badge className="bg-neutral-500 text-white border-0">Used</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Unused</Badge>
                      )}
                    </div>
                    <TicketDownloadBlock model={rowToModel(row, buyerName, buyerEmail)} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
          )}
        </div>
      )}
      <Dialog open={isInitiateModalOpen} onOpenChange={setIsInitiateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Initiate Ticket Transfer</DialogTitle>
            <DialogDescription>
              Provide the recipient's email address if you want them to get an automatic notification.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                Recipient Email (optional)
              </label>
              <Input
                id="email"
                type="email"
                placeholder="friend@example.com"
                value={transferEmail}
                onChange={(e) => setTransferEmail(e.target.value)}
                className="h-10"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank to share via link only.
              </p>
            </div>
            
            <Button 
              className="w-full h-11"
              onClick={handleConfirmTransfer}
              disabled={isSubmittingTransfer}
            >
              {isSubmittingTransfer ? "Initiating..." : "Initiate Transfer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Link Generated</DialogTitle>
            <DialogDescription>
              Share this link with the person you want to transfer the ticket to.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center space-x-2">
              <div className="grid flex-1 gap-2">
                <Input
                  defaultValue={activeTransferLink}
                  readOnly
                  className="h-10 text-sm font-mono bg-muted"
                />
              </div>
              <Button 
                size="sm" 
                className="px-3" 
                onClick={() => handleCopyLink(activeTransferLink, 'modal')}
              >
                {copiedId === 'modal' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="sr-only">Copy</span>
              </Button>
            </div>
            
            <Button 
              className="w-full bg-[#25D366] hover:bg-[#20bd5c] text-white flex items-center justify-center gap-2"
              onClick={() => {
                const waUrl = `https://wa.me/?text=${encodeURIComponent("Here's your ticket claim link: " + activeTransferLink)}`;
                window.open(waUrl, '_blank');
              }}
            >
              <Share2 className="h-4 w-4" />
              Share via WhatsApp
            </Button>
          </div>
          <DialogFooter className="sm:justify-start">
            <p className="text-xs text-muted-foreground italic">
              Anyone with this link can claim the ticket. Share it carefully.
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isComingSoonModalOpen} onOpenChange={setIsComingSoonModalOpen}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Ticket Resell — Coming Soon</DialogTitle>
            <div className="flex justify-center py-6">
              <Badge className="px-6 py-2 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm animate-pulse">
                Coming Soon
              </Badge>
            </div>
            <DialogDescription className="text-center text-base leading-relaxed text-foreground/80">
              Can't make it? Soon you'll be able to list your ticket back into the pool. 
              If someone buys it, you get refunded automatically minus a small fee. 
              We're putting the finishing touches on this feature.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center mt-2">
            <Button 
              onClick={() => setIsComingSoonModalOpen(false)} 
              className="w-full sm:w-auto px-12 h-11 bg-primary hover:bg-primary/90"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyTicketsPage;

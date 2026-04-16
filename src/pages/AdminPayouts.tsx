import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Banknote, 
  Copy, 
  CheckCircle2, 
  Search, 
  ArrowLeft, 
  Loader2, 
  ExternalLink,
  History
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { getSupabaseClient } from "@/lib/supabase";

type PayoutItem = {
  resell_id: string;
  request_date: string;
  sold_date: string;
  refund_amount: number;
  seller_name: string;
  account_number: string;
  bank_name: string;
  account_name: string;
  status: string;
};

const ADMIN_EMAIL = "yusufquadir50@gmail.com";

export default function AdminPayoutsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const supabase = getSupabaseClient();

  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "paid">("pending");

  useEffect(() => {
    if (!authLoading && (!user || user.email !== ADMIN_EMAIL)) {
      toast.error("Unauthorized access");
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  async function loadPayouts() {
    if (!supabase || !user || user.email !== ADMIN_EMAIL) return;
    setIsLoading(true);
    try {
      // 1. Fetch from view
      const { data, error } = await supabase
        .from("admin_payout_queue")
        .select("*")
        .eq("status", activeTab === "pending" ? "completed" : "paid")
        .order(activeTab === "pending" ? "sold_date" : "request_date", { ascending: false });

      if (error) throw error;
      setPayouts(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load payout queue");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (user?.email === ADMIN_EMAIL) loadPayouts();
  }, [user, activeTab]);

  const copyBankDetails = (item: PayoutItem) => {
    const text = `₦${item.refund_amount.toLocaleString()} - ${item.account_number} - ${item.bank_name} - ${item.account_name}`;
    navigator.clipboard.writeText(text);
    toast.success("Details copied to clipboard!");
  };

  const markAsPaid = async (resellId: string) => {
    if (!supabase || !window.confirm("Mark this payout as paid? The user will be notified via email (if configured).")) return;
    
    try {
      const { error } = await supabase
        .from("ticket_resells")
        .update({ status: "paid", completed_at: new Date().toISOString() })
        .eq("id", resellId);

      if (error) throw error;
      toast.success("Payout marked as paid!");
      loadPayouts();
    } catch (err: any) {
      toast.error(err.message || "Failed to update payout status");
    }
  };

  const filteredPayouts = payouts.filter(p => 
    p.seller_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.account_number?.includes(searchQuery) ||
    p.bank_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || !user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <button 
            onClick={() => navigate("/admin")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <h1 className="text-3xl font-extrabold text-foreground flex items-center gap-3">
            <Banknote className="w-8 h-8 text-green-500" />
            Payout Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl">
          <Button 
            variant={activeTab === "pending" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("pending")}
            className="rounded-lg h-9"
          >
            Pending
          </Button>
          <Button 
            variant={activeTab === "paid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("paid")}
            className="rounded-lg h-9"
          >
            <History className="w-4 h-4 mr-1.5" />
            History
          </Button>
        </div>
      </div>

      {/* Stats & Search */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, bank, or account number..."
            className="pl-10 h-11 bg-card border-border"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-primary">Pending Payouts Total:</span>
          <span className="text-xl font-black text-primary">
            ₦{payouts.reduce((acc, curr) => acc + (curr.status === 'completed' ? curr.refund_amount : 0), 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Sold Date</TableHead>
              <TableHead>Seller Details</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Bank / Account</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary/40" />
                </TableCell>
              </TableRow>
            ) : filteredPayouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center text-muted-foreground">
                  No {activeTab} payouts found.
                </TableCell>
              </TableRow>
            ) : (
              filteredPayouts.map((item) => (
                <TableRow key={item.resell_id} className="group transition-colors">
                  <TableCell className="text-sm font-medium">
                    {new Date(item.sold_date).toLocaleDateString()}
                    <div className="text-[10px] text-muted-foreground uppercase">{new Date(item.sold_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-foreground">{item.seller_name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> {item.resell_id.slice(0, 8)}
                    </div>
                  </TableCell>
                  <TableCell className="font-black text-lg text-foreground">
                    ₦{item.refund_amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold">{item.bank_name}</div>
                    <div className="text-sm text-muted-foreground font-mono">{item.account_number}</div>
                    <div className="text-[11px] text-primary/70 font-bold uppercase tracking-wide truncate max-w-[150px]">{item.account_name}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => copyBankDetails(item)}
                        title="Copy to Clipboard"
                        className="h-9 w-9 p-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      {item.status === 'completed' && (
                        <Button 
                          size="sm" 
                          onClick={() => markAsPaid(item.resell_id)}
                          className="bg-green-600 hover:bg-green-700 text-white gap-1.5 h-9"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Mark Paid
                        </Button>
                      )}
                      {item.status === 'paid' && (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 h-9 px-3">
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          Paid
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Secure Payout Dashboard &bull; Tixora Admin v1.0
      </p>
    </div>
  );
}

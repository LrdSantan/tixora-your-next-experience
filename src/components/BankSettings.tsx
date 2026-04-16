import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Landmark, Check, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

type Bank = {
  name: string;
  code: string;
};

export function BankSettings() {
  const { user, session } = useAuth();
  const supabase = getSupabaseClient();

  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  
  const [isResolving, setIsResolving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Fetch bank list from Paystack (Public API)
  const { data: banks, isLoading: banksLoading } = useQuery<Bank[]>({
    queryKey: ["nigerian-banks"],
    queryFn: async () => {
      const res = await fetch("https://api.paystack.co/bank?country=nigeria");
      const json = await res.json();
      return json.data || [];
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  // 2. Load existing profile
  useEffect(() => {
    async function loadProfile() {
      if (!supabase || !user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("bank_code, bank_name, account_number, account_name")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setBankCode(data.bank_code || "");
        setBankName(data.bank_name || "");
        setAccountNumber(data.account_number || "");
        setAccountName(data.account_name || "");
      }
    }
    loadProfile();
  }, [supabase, user]);

  // 3. Resolve account name
  useEffect(() => {
    const resolve = async () => {
      if (accountNumber.length === 10 && bankCode && supabase && session) {
        setIsResolving(true);
        setAccountName(""); // Reset while resolving
        try {
          const { data, error } = await supabase.functions.invoke("resolve-bank", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: { account_number: accountNumber, bank_code: bankCode },
          });

          if (error) throw error;
          if (data?.ok === false) throw new Error(data.error);
          
          setAccountName(data.account_name);
          toast.success("Account verified!");
        } catch (err: any) {
          console.error("Resolve error:", err);
          toast.error(err.message || "Could not verify account. Check details.");
        } finally {
          setIsResolving(false);
        }
      }
    };

    const timer = setTimeout(resolve, 500); // Debounce
    return () => clearTimeout(timer);
  }, [accountNumber, bankCode, supabase, session]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;
    if (!accountName) {
      toast.error("Please verify your account details first.");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          bank_code: bankCode,
          bank_name: bankName,
          account_number: accountNumber,
          account_name: accountName,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast.success("Bank settings saved successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save bank settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 rounded-full bg-primary/10 text-primary">
          <Landmark className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Bank Settings</h2>
          <p className="text-sm text-muted-foreground">Where should we send your resale earnings?</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="bank">Select Bank</Label>
          <Select
            value={bankCode}
            onValueChange={(val) => {
              setBankCode(val);
              setBankName(banks?.find((b) => b.code === val)?.name || "");
            }}
            disabled={banksLoading}
          >
            <SelectTrigger id="bank" className="w-full">
              <SelectValue placeholder={banksLoading ? "Loading banks..." : "Choose a bank"} />
            </SelectTrigger>
            <SelectContent>
              {banks?.map((bank) => (
                <SelectItem key={bank.code} value={bank.code}>
                  {bank.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account_number">Account Number</Label>
          <div className="relative">
            <Input
              id="account_number"
              type="text"
              inputMode="numeric"
              maxLength={10}
              placeholder="0123456789"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
              className="pr-10"
              required
            />
            {isResolving && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isResolving && accountName && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Check className="w-4 h-4 text-green-500" />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account_name">Account Name (Read-only)</Label>
          <Input
            id="account_name"
            type="text"
            value={accountName}
            readOnly
            className="bg-muted text-muted-foreground cursor-not-allowed border-dashed"
            placeholder="Verified account name shows here"
          />
          {accountName && (
            <p className="text-[11px] text-green-600 font-medium animate-in fade-in slide-in-from-top-1">
              Account successfully verified with your bank.
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full h-11"
          disabled={isSaving || isResolving || !accountName}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving Settings...
            </>
          ) : (
            "Save Bank Details"
          )}
        </Button>

        <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 flex gap-3 text-amber-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Please ensure these details are correct. <strong>Tixora</strong> is not responsible for funds sent to incorrect accounts.
          </p>
        </div>
      </form>
    </div>
  );
}

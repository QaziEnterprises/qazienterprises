import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Lock, Unlock, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Printer } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

interface CashRegisterEntry {
  id: string;
  date: string;
  opening_balance: number;
  cash_in: number;
  cash_out: number;
  expected_balance: number;
  actual_balance: number | null;
  discrepancy: number;
  notes: string | null;
  status: string;
}

export default function CashRegisterPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [todayEntry, setTodayEntry] = useState<CashRegisterEntry | null>(null);
  const [history, setHistory] = useState<CashRegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState("");
  const [actualBalance, setActualBalance] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const fetchData = async () => {
    try {
      const [{ data: todayData }, { data: historyData }, { data: todaySales }, { data: todayExpenses }, { data: todayPurchases }] = await Promise.all([
        supabase.from("cash_register").select("*").eq("date", todayStr).maybeSingle(),
        supabase.from("cash_register").select("*").order("date", { ascending: false }).limit(30),
        supabase.from("sale_transactions").select("total, payment_method").eq("date", todayStr),
        supabase.from("expenses").select("amount").eq("date", todayStr),
        supabase.from("purchases").select("total, payment_method").eq("date", todayStr),
      ]);

      const cashIn = (todaySales || []).filter((s: any) => s.payment_method === "cash").reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
      const cashOut = (todayExpenses || []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0) +
        (todayPurchases || []).filter((p: any) => p.payment_method === "cash").reduce((sum: number, p: any) => sum + Number(p.total || 0), 0);

      if (todayData) {
        const entry = todayData as unknown as CashRegisterEntry;
        entry.cash_in = cashIn;
        entry.cash_out = cashOut;
        entry.expected_balance = entry.opening_balance + cashIn - cashOut;
        setTodayEntry(entry);

        // Auto-update cash_in/cash_out
        await supabase.from("cash_register").update({
          cash_in: cashIn,
          cash_out: cashOut,
          expected_balance: entry.opening_balance + cashIn - cashOut,
        }).eq("id", entry.id);
      } else {
        setTodayEntry(null);
      }

      setHistory((historyData as unknown as CashRegisterEntry[]) || []);
    } catch (e) {
      console.error("Cash register fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenDrawer = async () => {
    const balance = parseFloat(openingBalance);
    if (isNaN(balance) || balance < 0) {
      toast({ title: "Enter a valid opening balance", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase.from("cash_register").insert({
        date: todayStr,
        opening_balance: balance,
        status: "open",
        opened_by: user?.id,
      });
      if (error) throw error;
      toast({ title: "Cash drawer opened for today" });
      setOpeningBalance("");
      fetchData();
    } catch (e: any) {
      toast({ title: "Error opening drawer", description: e.message, variant: "destructive" });
    }
  };

  const handleCloseDrawer = async () => {
    if (!todayEntry) return;
    const actual = parseFloat(actualBalance);
    if (isNaN(actual) || actual < 0) {
      toast({ title: "Enter actual cash in hand", variant: "destructive" });
      return;
    }
    const discrepancy = actual - todayEntry.expected_balance;
    try {
      const { error } = await supabase.from("cash_register").update({
        actual_balance: actual,
        discrepancy,
        notes: closingNotes || null,
        status: "closed",
        closed_by: user?.id,
      }).eq("id", todayEntry.id);
      if (error) throw error;
      toast({ title: "Cash drawer closed successfully" });
      setActualBalance("");
      setClosingNotes("");
      fetchData();
    } catch (e: any) {
      toast({ title: "Error closing drawer", description: e.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Daily Cash Register</h1>
        <p className="text-muted-foreground">Track cash in/out and reconcile at end of day — {format(new Date(), "EEEE, dd MMM yyyy")}</p>
      </div>

      {/* Today's Cash Drawer */}
      {!todayEntry ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Unlock className="h-5 w-5 text-green-600" /> Open Today's Cash Drawer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Opening Balance (Rs)</label>
                <Input type="number" placeholder="Enter starting cash..." value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="mt-1" />
              </div>
              <Button onClick={handleOpenDrawer} className="w-full">Open Drawer</Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Status Banner */}
          <div className={`flex items-center gap-3 rounded-lg border p-4 ${todayEntry.status === "open" ? "border-green-300 bg-green-50 dark:bg-green-950/20" : "border-muted bg-muted/30"}`}>
            {todayEntry.status === "open" ? <Unlock className="h-5 w-5 text-green-600" /> : <Lock className="h-5 w-5 text-muted-foreground" />}
            <div>
              <span className="font-semibold">{todayEntry.status === "open" ? "Drawer is OPEN" : "Drawer CLOSED"}</span>
              <p className="text-xs text-muted-foreground">Started with Rs {todayEntry.opening_balance.toLocaleString()}</p>
            </div>
            <Badge variant={todayEntry.status === "open" ? "default" : "secondary"} className="ml-auto">{todayEntry.status.toUpperCase()}</Badge>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Opening</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">Rs {todayEntry.opening_balance.toLocaleString()}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Cash In (Sales)</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-green-600">+ Rs {todayEntry.cash_in.toLocaleString()}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Cash Out</CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-destructive">- Rs {todayEntry.cash_out.toLocaleString()}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm text-muted-foreground">Expected Balance</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">Rs {todayEntry.expected_balance.toLocaleString()}</div></CardContent>
            </Card>
          </div>

          {/* Close Drawer Section */}
          {todayEntry.status === "open" && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Lock className="h-5 w-5" /> Close Drawer — End of Day</CardTitle></CardHeader>
              <CardContent className="space-y-4 max-w-md">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Actual Cash in Hand (Rs)</label>
                  <Input type="number" placeholder="Count and enter actual cash..." value={actualBalance} onChange={(e) => setActualBalance(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Notes (optional)</label>
                  <Textarea placeholder="Any notes about discrepancies..." value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} className="mt-1" rows={2} />
                </div>
                {actualBalance && !isNaN(parseFloat(actualBalance)) && (
                  <div className="rounded-lg border p-3 text-sm">
                    <div className="flex justify-between"><span>Expected:</span><span className="font-medium">Rs {todayEntry.expected_balance.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Actual:</span><span className="font-medium">Rs {parseFloat(actualBalance).toLocaleString()}</span></div>
                    <div className="flex justify-between border-t mt-2 pt-2">
                      <span>Discrepancy:</span>
                      <span className={`font-bold ${parseFloat(actualBalance) - todayEntry.expected_balance === 0 ? "text-green-600" : "text-destructive"}`}>
                        Rs {(parseFloat(actualBalance) - todayEntry.expected_balance).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
                <Button onClick={handleCloseDrawer} variant="destructive" className="w-full">Close Drawer</Button>
              </CardContent>
            </Card>
          )}

          {/* Closed Summary */}
          {todayEntry.status === "closed" && todayEntry.actual_balance !== null && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Reconciliation</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Actual Cash:</span><span className="font-bold">Rs {todayEntry.actual_balance.toLocaleString()}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Discrepancy:</span>
                  <span className={`font-bold flex items-center gap-1 ${todayEntry.discrepancy === 0 ? "text-green-600" : "text-destructive"}`}>
                    {todayEntry.discrepancy === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    Rs {todayEntry.discrepancy.toLocaleString()}
                  </span>
                </div>
                {todayEntry.notes && <div className="mt-2 p-2 bg-muted rounded text-xs">{todayEntry.notes}</div>}
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Recent History</h2>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-right p-3 font-medium">Opening</th>
                  <th className="text-right p-3 font-medium">Cash In</th>
                  <th className="text-right p-3 font-medium">Cash Out</th>
                  <th className="text-right p-3 font-medium">Expected</th>
                  <th className="text-right p-3 font-medium">Actual</th>
                  <th className="text-right p-3 font-medium">Diff</th>
                  <th className="text-center p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">{format(new Date(entry.date), "dd MMM")}</td>
                    <td className="p-3 text-right tabular-nums">Rs {entry.opening_balance.toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums text-green-600">+{entry.cash_in.toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums text-destructive">-{entry.cash_out.toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums">Rs {entry.expected_balance.toLocaleString()}</td>
                    <td className="p-3 text-right tabular-nums">{entry.actual_balance !== null ? `Rs ${entry.actual_balance.toLocaleString()}` : "—"}</td>
                    <td className={`p-3 text-right tabular-nums font-medium ${entry.discrepancy === 0 ? "text-green-600" : "text-destructive"}`}>
                      {entry.actual_balance !== null ? `Rs ${entry.discrepancy.toLocaleString()}` : "—"}
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={entry.status === "open" ? "default" : "secondary"} className="text-xs">{entry.status}</Badge>
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

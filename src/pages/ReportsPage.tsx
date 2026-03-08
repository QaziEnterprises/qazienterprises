import { useState, useEffect, useCallback, useMemo } from "react";
import { CalendarDays, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Receipt, AlertTriangle, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { exportToExcel, printAsPDF } from "@/lib/exportUtils";
import { toast } from "sonner";
import DayTransactionsDialog from "@/components/reports/DayTransactionsDialog";
import DailyTrendChart from "@/components/reports/DailyTrendChart";

interface DailySummary {
  date: string;
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  profit: number;
  salesCount: number;
  purchasesCount: number;
  expensesCount: number;
}

export default function ReportsPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<{ name: string; quantity: number; alert_threshold: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [{ data: sales }, { data: purchases }, { data: expenses }, { data: products }] = await Promise.all([
          supabase.from("sale_transactions").select("date, total").gte("date", startDate).lte("date", endDate),
          supabase.from("purchases").select("date, total").gte("date", startDate).lte("date", endDate),
          supabase.from("expenses").select("date, amount").gte("date", startDate).lte("date", endDate),
          supabase.from("products").select("name, quantity, alert_threshold"),
        ]);

        setLowStockProducts(
          (products || [])
            .filter((p) => p.alert_threshold && p.alert_threshold > 0 && (p.quantity || 0) <= p.alert_threshold)
            .map((p) => ({ name: p.name, quantity: p.quantity || 0, alert_threshold: p.alert_threshold || 0 }))
        );

        const dateMap = new Map<string, DailySummary>();
        const getOrCreate = (date: string): DailySummary => {
          if (!dateMap.has(date)) dateMap.set(date, { date, totalSales: 0, totalPurchases: 0, totalExpenses: 0, profit: 0, salesCount: 0, purchasesCount: 0, expensesCount: 0 });
          return dateMap.get(date)!;
        };

        (sales || []).forEach((s) => { const d = getOrCreate(s.date); d.totalSales += Number(s.total || 0); d.salesCount++; });
        (purchases || []).forEach((p) => { const d = getOrCreate(p.date); d.totalPurchases += Number(p.total || 0); d.purchasesCount++; });
        (expenses || []).forEach((e) => { const d = getOrCreate(e.date); d.totalExpenses += Number(e.amount || 0); d.expensesCount++; });

        dateMap.forEach((d) => { d.profit = d.totalSales - d.totalPurchases - d.totalExpenses; });

        const sorted = Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));
        setSummaries(sorted);
      } catch (e) {
        console.error("Reports fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [startDate, endDate, refreshKey]);

  const totals = summaries.reduce(
    (acc, d) => ({
      sales: acc.sales + d.totalSales,
      purchases: acc.purchases + d.totalPurchases,
      expenses: acc.expenses + d.totalExpenses,
      profit: acc.profit + d.profit,
    }),
    { sales: 0, purchases: 0, expenses: 0, profit: 0 }
  );

  const handleDataChanged = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Reports</h1>
          <p className="text-sm text-muted-foreground">Sales, purchases & expenses summary</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" disabled={summaries.length === 0} onClick={() => {
            exportToExcel(summaries.map(d => ({
              Date: d.date, Sales: d.totalSales, Purchases: d.totalPurchases,
              Expenses: d.totalExpenses, "Net Profit": d.profit,
              "Sales Count": d.salesCount, "Purchases Count": d.purchasesCount, "Expenses Count": d.expensesCount,
            })), "Daily_Reports");
            toast.success("Exported to Excel");
          }}><Download className="h-4 w-4" /> Excel</Button>
          <Button size="sm" variant="outline" className="gap-2" disabled={summaries.length === 0} onClick={() => {
            printAsPDF("Daily Reports", ["Date", "Sales", "Purchases", "Expenses", "Net Profit"],
              summaries.map(d => [d.date, `Rs ${d.totalSales.toLocaleString()}`, `Rs ${d.totalPurchases.toLocaleString()}`,
                `Rs ${d.totalExpenses.toLocaleString()}`, `Rs ${d.profit.toLocaleString()}`])
            );
          }}><Download className="h-4 w-4" /> PDF</Button>
        </div>
      </div>

      <DayTransactionsDialog open={!!selectedDate} onOpenChange={(o) => !o && setSelectedDate(null)} date={selectedDate || ""} onDataChanged={handleDataChanged} />

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-destructive">Low Stock Alert — {lowStockProducts.length} product(s)</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lowStockProducts.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded border bg-background p-2 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="text-destructive font-bold">{p.quantity} / {p.alert_threshold}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Date Filters */}
      <div className="flex gap-4 mb-6 items-end">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> From</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1"><CalendarDays className="h-3 w-3" /> To</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">Rs {totals.sales.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Purchases</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-600">Rs {totals.purchases.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">Rs {totals.expenses.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
            <DollarSign className="h-4 w-4" />
          </CardHeader>
          <CardContent><div className={`text-2xl font-bold ${totals.profit >= 0 ? "text-green-600" : "text-destructive"}`}>Rs {totals.profit.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      {!loading && summaries.length > 1 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyTrendChart data={summaries} />
          </CardContent>
        </Card>
      )}

      {/* Daily Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : summaries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">No transactions found for this date range.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Sales</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Purchases</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Expenses</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Net Profit</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((d, i) => (
                <motion.tr key={d.date} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedDate(d.date)}>
                  <td className="px-4 py-3 font-medium">{d.date}</td>
                  <td className="px-4 py-3 text-right text-green-600">Rs {d.totalSales.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-blue-600">Rs {d.totalPurchases.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-destructive">Rs {d.totalExpenses.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right font-bold ${d.profit >= 0 ? "text-green-600" : "text-destructive"}`}>
                    Rs {d.profit.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {d.salesCount > 0 && <Badge variant="secondary" className="text-xs">{d.salesCount} sale{d.salesCount > 1 ? "s" : ""}</Badge>}
                      {d.purchasesCount > 0 && <Badge variant="outline" className="text-xs">{d.purchasesCount} purch.</Badge>}
                      {d.expensesCount > 0 && <Badge variant="destructive" className="text-xs">{d.expensesCount} exp.</Badge>}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/50 font-bold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right text-green-600">Rs {totals.sales.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-blue-600">Rs {totals.purchases.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-destructive">Rs {totals.expenses.toLocaleString()}</td>
                <td className={`px-4 py-3 text-right ${totals.profit >= 0 ? "text-green-600" : "text-destructive"}`}>Rs {totals.profit.toLocaleString()}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

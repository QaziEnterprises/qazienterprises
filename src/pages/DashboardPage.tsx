import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Package, TrendingUp, AlertTriangle, ShoppingCart, Receipt, DollarSign,
  Users, Boxes, Clock, CreditCard, ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { retryQuery } from "@/lib/retryFetch";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import DailyTrendChart from "@/components/reports/DailyTrendChart";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--info))",
];

interface TodaySummary {
  todaySales: number;
  todayPurchases: number;
  todayExpenses: number;
  todayProfit: number;
  todaySalesCount: number;
  todayPurchasesCount: number;
  todayExpensesCount: number;
  todayJC: number;
  todayEP: number;
  todayBT: number;
  todayCash: number;
}

interface RecentSale {
  id: string;
  invoice_no: string | null;
  total: number;
  payment_method: string | null;
  date: string;
  customer_type: string | null;
}

interface TopDebtor {
  id: string;
  name: string;
  current_balance: number;
}

interface DailySummary {
  date: string;
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  profit: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [lowStockProducts, setLowStockProducts] = useState<{ id: string; name: string; quantity: number; alert_threshold: number; purchase_price: number }[]>([]);
  const [today, setToday] = useState<TodaySummary>({ todaySales: 0, todayPurchases: 0, todayExpenses: 0, todayProfit: 0, todaySalesCount: 0, todayPurchasesCount: 0, todayExpensesCount: 0, todayJC: 0, todayEP: 0, todayBT: 0, todayCash: 0 });
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalContacts, setTotalContacts] = useState(0);
  const [pendingPayments, setPendingPayments] = useState(0);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [topDebtors, setTopDebtors] = useState<TopDebtor[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailySummary[]>([]);

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const last14Days = new Date();
    last14Days.setDate(last14Days.getDate() - 13);
    const startDateStr = last14Days.toISOString().split("T")[0];
    
    const fetchData = async () => {
      try {
        const [
          { data: todaySales },
          { data: todayPurchases },
          { data: todayExpenses },
          { data: products },
          contactsResult,
          { data: pendingSales },
          { data: recent },
          { data: debtors },
          { data: rangeSales },
          { data: rangePurchases },
          { data: rangeExpenses },
        ] = await Promise.all([
          retryQuery(() => supabase.from("sale_transactions").select("total, payment_method").eq("date", todayStr)),
          retryQuery(() => supabase.from("purchases").select("total").eq("date", todayStr)),
          retryQuery(() => supabase.from("expenses").select("amount").eq("date", todayStr)),
          retryQuery(() => supabase.from("products").select("id, name, quantity, alert_threshold, purchase_price")),
          retryQuery(() => supabase.from("contacts").select("*", { count: "exact", head: true }) as any),
          retryQuery(() => supabase.from("sale_transactions").select("total").eq("payment_status", "due")),
          retryQuery(() => supabase.from("sale_transactions").select("id, invoice_no, total, payment_method, date, customer_type").order("created_at", { ascending: false }).limit(5)),
          supabase.from("contacts").select("id, name, current_balance").gt("current_balance", 0).order("current_balance", { ascending: false }).limit(5),
          retryQuery(() => supabase.from("sale_transactions").select("date, total").gte("date", startDateStr).lte("date", todayStr)),
          retryQuery(() => supabase.from("purchases").select("date, total").gte("date", startDateStr).lte("date", todayStr)),
          retryQuery(() => supabase.from("expenses").select("date, amount").gte("date", startDateStr).lte("date", todayStr)),
        ]);

        const salesTotal = (todaySales || []).reduce((s, r) => s + Number(r.total || 0), 0);
        const purchTotal = (todayPurchases || []).reduce((s, r) => s + Number(r.total || 0), 0);
        const expTotal = (todayExpenses || []).reduce((s, r) => s + Number(r.amount || 0), 0);

        const todayJC = (todaySales || []).filter(r => r.payment_method === 'jazzcash').reduce((s, r) => s + Number(r.total || 0), 0);
        const todayEP = (todaySales || []).filter(r => r.payment_method === 'easypaisa').reduce((s, r) => s + Number(r.total || 0), 0);
        const todayBT = (todaySales || []).filter(r => r.payment_method === 'bank').reduce((s, r) => s + Number(r.total || 0), 0);
        const todayCash = (todaySales || []).filter(r => r.payment_method === 'cash').reduce((s, r) => s + Number(r.total || 0), 0);

        setToday({
          todaySales: salesTotal, todayPurchases: purchTotal, todayExpenses: expTotal,
          todayProfit: salesTotal - purchTotal - expTotal,
          todaySalesCount: todaySales?.length || 0, todayPurchasesCount: todayPurchases?.length || 0, todayExpensesCount: todayExpenses?.length || 0,
          todayJC, todayEP, todayBT, todayCash,
        });

        const allProducts = products || [];
        setTotalProducts(allProducts.length);
        setTotalContacts((contactsResult as any)?.count || 0);
        setPendingPayments((pendingSales || []).reduce((s, r) => s + Number(r.total || 0), 0));
        setRecentSales((recent || []).map((r: any) => ({ id: r.id, invoice_no: r.invoice_no, total: Number(r.total || 0), payment_method: r.payment_method, date: r.date, customer_type: r.customer_type })));
        setTopDebtors((debtors || []).map((d: any) => ({ id: d.id, name: d.name, current_balance: Number(d.current_balance || 0) })));

        setLowStockProducts(
          allProducts
            .filter((p: any) => p.alert_threshold && p.alert_threshold > 0 && (p.quantity || 0) <= p.alert_threshold)
            .map((p: any) => ({ id: p.id, name: p.name, quantity: p.quantity || 0, alert_threshold: p.alert_threshold || 0, purchase_price: p.purchase_price || 0 }))
        );

        // Process daily trend (last 14 days) directly from transactions
        const dateMap = new Map<string, DailySummary>();
        const getOrCreate = (date: string): DailySummary => {
          if (!dateMap.has(date)) dateMap.set(date, { date, totalSales: 0, totalPurchases: 0, totalExpenses: 0, profit: 0 });
          return dateMap.get(date)!;
        };

        (rangeSales || []).forEach((s: any) => {
          const d = getOrCreate(s.date);
          d.totalSales += Number(s.total || 0);
        });
        (rangePurchases || []).forEach((p: any) => {
          const d = getOrCreate(p.date);
          d.totalPurchases += Number(p.total || 0);
        });
        (rangeExpenses || []).forEach((e: any) => {
          const d = getOrCreate(e.date);
          d.totalExpenses += Number(e.amount || 0);
        });

        dateMap.forEach((d) => {
          d.profit = d.totalSales - d.totalPurchases - d.totalExpenses;
        });

        setDailyTrend(Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date)));
      } catch (e) {
        console.error("Dashboard fetch error:", e);
        setDailyTrend([]);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your shop operations</p>
      </div>

      {/* Today's Summary - TOP */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Today's Summary</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Sales</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">Rs {today.todaySales.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{today.todaySalesCount} transaction(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Purchases</CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">Rs {today.todayPurchases.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{today.todayPurchasesCount} order(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Expenses</CardTitle>
              <Receipt className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">Rs {today.todayExpenses.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{today.todayExpensesCount} expense(s)</p>
            </CardContent>
          </Card>
          <Card className={`relative overflow-hidden ${today.todayProfit >= 0 ? "border-green-300 dark:border-green-800" : "border-destructive/30"}`}>
            <div className={`absolute inset-0 opacity-5 ${today.todayProfit >= 0 ? "bg-green-500" : "bg-destructive"}`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Net Profit</CardTitle>
              <DollarSign className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${today.todayProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                Rs {today.todayProfit.toLocaleString()}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={today.todayProfit >= 0 ? "default" : "destructive"} className="text-[10px]">
                  {today.todaySales > 0 ? `${((today.todayProfit / today.todaySales) * 100).toFixed(1)}% margin` : "No sales"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Daily Trend Chart */}
      {dailyTrend.length > 0 && (
        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                14-Day Business Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DailyTrendChart data={dailyTrend} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts + Payment Breakdown */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {(() => {
          const data = [
            { name: "Sales", value: today.todaySales },
            { name: "Purchases", value: today.todayPurchases },
            { name: "Expenses", value: today.todayExpenses },
          ].filter(d => d.value > 0);
          if (data.length === 0) return null;
          return (
            <Card className="sm:col-span-2 lg:col-span-1">
              <CardHeader><CardTitle className="text-sm">Today's Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {data.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`Rs ${v.toLocaleString()}`, "Amount"]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          );
        })()}
        <Card>
          <CardHeader><CardTitle className="text-sm">Transactions Today</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { name: "Sales", count: today.todaySalesCount },
                { name: "Purchases", count: today.todayPurchasesCount },
                { name: "Expenses", count: today.todayExpensesCount },
              ]}>
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  <Cell fill="hsl(var(--chart-3))" />
                  <Cell fill="hsl(var(--info))" />
                  <Cell fill="hsl(var(--chart-4))" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Payment Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Cash</span><span className="font-medium">Rs {today.todayCash.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">JazzCash</span><span className="font-medium text-accent">Rs {today.todayJC.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">EasyPaisa</span><span className="font-medium text-success">Rs {today.todayEP.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Bank Transfer</span><span className="font-medium text-primary">Rs {today.todayBT.toLocaleString()}</span></div>
            <div className="border-t my-1" />
            <div className="flex justify-between"><span className="text-muted-foreground">Avg Sale</span><span className="font-medium">{today.todaySalesCount > 0 ? `Rs ${Math.round(today.todaySales / today.todaySalesCount).toLocaleString()}` : "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Margin</span><span className={`font-medium ${today.todaySales > 0 && today.todayProfit >= 0 ? "text-success" : "text-destructive"}`}>{today.todaySales > 0 ? `${((today.todayProfit / today.todaySales) * 100).toFixed(1)}%` : "—"}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/products-db")}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2"><Boxes className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{totalProducts}</p>
              <p className="text-xs text-muted-foreground">Total Products</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/contacts")}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/10 p-2"><Users className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold">{totalContacts}</p>
              <p className="text-xs text-muted-foreground">Contacts</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/bills")}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2"><CreditCard className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold text-amber-600">Rs {pendingPayments.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Pending Payments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-destructive/10 p-2"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
            <div>
              <p className="text-2xl font-bold text-destructive">{lowStockProducts.length}</p>
              <p className="text-xs text-muted-foreground">Low Stock Items</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alerts */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className={`mb-6 rounded-lg border p-4 ${lowStockProducts.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${lowStockProducts.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            <h3 className={`font-semibold ${lowStockProducts.length > 0 ? "text-destructive" : "text-foreground"}`}>
              {lowStockProducts.length > 0 ? `Low Stock Alert — ${lowStockProducts.length} product(s)` : "Stock Levels Healthy"}
            </h3>
          </div>
          <Link to="/products-db"><Button variant="outline" size="sm" className="text-xs">View Products</Button></Link>
        </div>
        {lowStockProducts.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lowStockProducts.map((p) => {
              const reorderQty = Math.max(p.alert_threshold * 2 - p.quantity, p.alert_threshold);
              return (
                <div key={p.id} className="flex items-center justify-between rounded border bg-background p-2 text-sm gap-2">
                  <div className="min-w-0">
                    <span className="font-medium block truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">Stock: <span className="text-destructive font-medium">{p.quantity}</span> / Min: {p.alert_threshold}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs flex-shrink-0 h-7 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => navigate(`/purchases?reorder=${p.id}&product=${encodeURIComponent(p.name)}&qty=${reorderQty}&price=${p.purchase_price}`)}
                  >
                    <ShoppingCart className="h-3 w-3 mr-1" /> Reorder
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">All products are above their minimum stock levels.</p>
        )}
      </motion.div>

      {/* Recent Sales + Top Debtors */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Recent Sales</CardTitle>
            <Link to="/bills"><Button variant="ghost" size="sm" className="text-xs h-7">View All <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No sales recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {recentSales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium block truncate">{s.invoice_no || "No Invoice"}</span>
                      <span className="text-xs text-muted-foreground">{s.date} · {s.customer_type === "walk-in" ? "Walk-in" : "Customer"}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold">Rs {s.total.toLocaleString()}</span>
                      <Badge variant="outline" className="ml-2 text-[10px]">{s.payment_method || "cash"}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Top Outstanding Balances</CardTitle>
            <Link to="/contacts"><Button variant="ghost" size="sm" className="text-xs h-7">View All <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
          </CardHeader>
          <CardContent>
            {topDebtors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No outstanding balances.</p>
            ) : (
              <div className="space-y-2">
                {topDebtors.map((d, i) => (
                  <div key={d.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
                      <span className="font-medium truncate">{d.name}</span>
                    </div>
                    <span className="font-semibold text-amber-600 shrink-0">Rs {d.current_balance.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

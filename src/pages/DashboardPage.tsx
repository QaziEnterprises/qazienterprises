import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Package, Users, FileSpreadsheet, TrendingUp, ArrowDownRight, Banknote, Smartphone, CreditCard, Building2, AlertTriangle, ShoppingCart, Receipt, DollarSign, Wallet, Unlock, Lock, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInventory, getReceivables, getSales } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { InventoryItem } from "@/types";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";

const CHART_COLORS = [
  "hsl(38, 92%, 50%)", "hsl(222, 47%, 11%)", "hsl(142, 71%, 45%)",
  "hsl(0, 72%, 51%)", "hsl(220, 14%, 70%)", "hsl(280, 60%, 50%)",
  "hsl(190, 80%, 45%)", "hsl(30, 80%, 55%)", "hsl(160, 60%, 40%)", "hsl(350, 70%, 55%)",
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalItems: 0, totalInventoryValue: 0, totalReceivables: 0,
    totalParties: 0, totalCashSales: 0, totalUnpaid: 0,
    totalJC: 0, totalEP: 0, totalBT: 0,
  });
  const [topDebtors, setTopDebtors] = useState<{ name: string; balance: number }[]>([]);
  const [breakdownData, setBreakdownData] = useState<{ name: string; value: number }[]>([]);
  const [paymentData, setPaymentData] = useState<{ name: string; value: number }[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<{ id: string; name: string; quantity: number; alert_threshold: number; purchase_price: number }[]>([]);
  const [today, setToday] = useState<TodaySummary>({ todaySales: 0, todayPurchases: 0, todayExpenses: 0, todayProfit: 0, todaySalesCount: 0, todayPurchasesCount: 0, todayExpensesCount: 0, todayJC: 0, todayEP: 0, todayBT: 0, todayCash: 0 });
  const [cashRegister, setCashRegister] = useState<{ status: string; opening_balance: number; cash_in: number; cash_out: number; expected_balance: number } | null>(null);

  useEffect(() => {
    // Legacy localStorage data
    const inv = getInventory();
    const recv = getReceivables();
    const sales = getSales();

    const totalJC = sales.reduce((s, e) => s + e.jc, 0);
    const totalEP = sales.reduce((s, e) => s + e.ep, 0);
    const totalBT = sales.reduce((s, e) => s + e.bt, 0);
    const totalCash = sales.reduce((s, e) => s + e.cash, 0);

    setStats({
      totalItems: inv.length,
      totalInventoryValue: inv.reduce((sum, i) => sum + i.quantity * i.price, 0),
      totalReceivables: recv.reduce((sum, r) => sum + r.balance, 0),
      totalParties: recv.length,
      totalCashSales: totalCash,
      totalUnpaid: sales.reduce((sum, s) => sum + s.notPaid, 0),
      totalJC, totalEP, totalBT,
    });

    setPaymentData([
      { name: "Cash", value: totalCash },
      { name: "JazzCash", value: totalJC },
      { name: "EasyPaisa", value: totalEP },
      { name: "Bank Transfer", value: totalBT },
    ].filter((d) => d.value > 0));

    const debtors = recv
      .filter((r) => r.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10)
      .map((r) => ({ name: r.partyName.length > 15 ? r.partyName.slice(0, 15) + "…" : r.partyName, balance: r.balance }));
    setTopDebtors(debtors);

    const positive = recv.filter((r) => r.balance > 0);
    const negative = recv.filter((r) => r.balance < 0);
    const zero = recv.filter((r) => r.balance === 0);
    setBreakdownData([
      { name: "Owed to You", value: positive.reduce((s, r) => s + r.balance, 0) },
      { name: "You Owe", value: Math.abs(negative.reduce((s, r) => s + r.balance, 0)) },
      { name: "Settled", value: zero.length },
    ].filter((d) => d.value > 0));

    const lowStock = inv.filter((item) => {
      const threshold = (item as any).alertThreshold;
      return threshold && threshold > 0 && item.quantity <= threshold;
    });
    setLowStockItems(lowStock);

    // Fetch today's data from Supabase
    const todayStr = new Date().toISOString().split("T")[0];
    const fetchToday = async () => {
      try {
        const [{ data: todaySales }, { data: todayPurchases }, { data: todayExpenses }, { data: products }, { data: cashReg }] = await Promise.all([
          supabase.from("sale_transactions").select("total, payment_method").eq("date", todayStr),
          supabase.from("purchases").select("total").eq("date", todayStr),
          supabase.from("expenses").select("amount").eq("date", todayStr),
          supabase.from("products").select("id, name, quantity, alert_threshold, purchase_price"),
          supabase.from("cash_register").select("*").eq("date", todayStr).maybeSingle(),
        ]);

        const salesTotal = (todaySales || []).reduce((s, r) => s + Number(r.total || 0), 0);
        const purchTotal = (todayPurchases || []).reduce((s, r) => s + Number(r.total || 0), 0);
        const expTotal = (todayExpenses || []).reduce((s, r) => s + Number(r.amount || 0), 0);

        const todayJC = (todaySales || []).filter(r => r.payment_method === 'jazzcash').reduce((s, r) => s + Number(r.total || 0), 0);
        const todayEP = (todaySales || []).filter(r => r.payment_method === 'easypaisa').reduce((s, r) => s + Number(r.total || 0), 0);
        const todayBT = (todaySales || []).filter(r => r.payment_method === 'bank').reduce((s, r) => s + Number(r.total || 0), 0);
        const todayCash = (todaySales || []).filter(r => r.payment_method === 'cash').reduce((s, r) => s + Number(r.total || 0), 0);

        setToday({
          todaySales: salesTotal,
          todayPurchases: purchTotal,
          todayExpenses: expTotal,
          todayProfit: salesTotal - purchTotal - expTotal,
          todaySalesCount: todaySales?.length || 0,
          todayPurchasesCount: todayPurchases?.length || 0,
          todayExpensesCount: todayExpenses?.length || 0,
          todayJC, todayEP, todayBT, todayCash,
        });

        setLowStockProducts(
          (products || [])
            .filter((p: any) => p.alert_threshold && p.alert_threshold > 0 && (p.quantity || 0) <= p.alert_threshold)
            .map((p: any) => ({ id: p.id, name: p.name, quantity: p.quantity || 0, alert_threshold: p.alert_threshold || 0, purchase_price: p.purchase_price || 0 }))
        );

        // Cash register status
        if (cashReg) {
          const cr = cashReg as any;
          const cashIn = (todaySales || []).filter((s: any) => s.payment_method === "cash").reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);
          const cashOut = (todayExpenses || []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
          setCashRegister({
            status: cr.status,
            opening_balance: Number(cr.opening_balance || 0),
            cash_in: cashIn,
            cash_out: cashOut,
            expected_balance: Number(cr.opening_balance || 0) + cashIn - cashOut,
          });
        }
      } catch (e) {
        console.error("Dashboard fetch error:", e);
      }
    };
    fetchToday();
  }, []);

  const cards = [
    { title: "Inventory Items", value: stats.totalItems, format: "number", icon: Package, link: "/inventory", color: "text-accent" },
    { title: "Inventory Value", value: stats.totalInventoryValue, format: "currency", icon: TrendingUp, link: "/inventory", color: "text-green-600" },
    { title: "Total Receivables", value: stats.totalReceivables, format: "currency", icon: Users, link: "/receivables", color: "text-accent" },
    { title: "Active Parties", value: stats.totalParties, format: "number", icon: Users, link: "/receivables", color: "text-muted-foreground" },
    { title: "Cash Sales", value: stats.totalCashSales, format: "currency", icon: Banknote, link: "/sales", color: "text-green-600" },
    { title: "JazzCash (JC)", value: stats.totalJC, format: "currency", icon: Smartphone, link: "/sales", color: "text-accent" },
    { title: "EasyPaisa (EP)", value: stats.totalEP, format: "currency", icon: CreditCard, link: "/sales", color: "text-green-600" },
    { title: "Bank Transfer (BT)", value: stats.totalBT, format: "currency", icon: Building2, link: "/sales", color: "text-primary" },
    { title: "Unpaid Amount", value: stats.totalUnpaid, format: "currency", icon: ArrowDownRight, link: "/sales", color: "text-destructive" },
  ];

  const fmt = (val: number, format: string) =>
    format === "currency" ? `Rs ${val.toLocaleString()}` : val.toLocaleString();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your shop operations</p>
      </div>

      {/* Cash Register Widget */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <Link to="/cash-register">
          <Card className="hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 p-4">
              {cashRegister ? (
                <>
                  {cashRegister.status === "open" ? <Unlock className="h-6 w-6 text-green-600 flex-shrink-0" /> : <Lock className="h-6 w-6 text-muted-foreground flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Cash Register</span>
                      <Badge variant={cashRegister.status === "open" ? "default" : "secondary"} className="text-[10px]">{cashRegister.status.toUpperCase()}</Badge>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span>Opening: Rs {cashRegister.opening_balance.toLocaleString()}</span>
                      <span className="text-green-600">In: +Rs {cashRegister.cash_in.toLocaleString()}</span>
                      <span className="text-destructive">Out: -Rs {cashRegister.cash_out.toLocaleString()}</span>
                      <span className="font-medium text-foreground">Expected: Rs {cashRegister.expected_balance.toLocaleString()}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Wallet className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="font-semibold">Cash Register</span>
                    <p className="text-xs text-muted-foreground">Drawer not opened today — click to open</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </Link>
      </motion.div>

      {/* Low Stock Alerts — Products DB */}
      {lowStockProducts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h3 className="font-semibold text-destructive">Low Stock Alert — {lowStockProducts.length} product(s)</h3>
            </div>
            <Link to="/products-db"><Button variant="outline" size="sm" className="text-xs">View Products</Button></Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lowStockProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded border bg-background p-2 text-sm gap-2">
                <div className="min-w-0">
                  <span className="font-medium block truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">Stock: {p.quantity} / Min: {p.alert_threshold}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs flex-shrink-0 h-7 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const reorderQty = Math.max(p.alert_threshold * 2 - p.quantity, p.alert_threshold);
                    navigate(`/purchases?reorder=${p.id}&product=${encodeURIComponent(p.name)}&qty=${reorderQty}&price=${p.purchase_price}`);
                  }}
                >
                  <ShoppingCart className="h-3 w-3 mr-1" /> Reorder
                </Button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Low Stock Alerts — Legacy Inventory */}
      {lowStockItems.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <h3 className="font-semibold text-orange-600">Inventory Low Stock — {lowStockItems.length} item(s)</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lowStockItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded border bg-background p-2 text-sm">
                <span className="font-medium">{item.name}</span>
                <span className="text-destructive font-bold">{item.quantity} left</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Today's Summary */}
      <div className="mb-8">
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
                <span className="text-xs text-muted-foreground">Sales - Purchases - Expenses</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's Charts */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
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
                    <Cell fill="hsl(142, 71%, 45%)" />
                    <Cell fill="hsl(220, 60%, 55%)" />
                    <Cell fill="hsl(0, 72%, 51%)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Quick Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Cash</span><span className="font-medium">Rs {today.todayCash.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">JazzCash</span><span className="font-medium text-accent">Rs {today.todayJC.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">EasyPaisa</span><span className="font-medium text-green-600">Rs {today.todayEP.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Bank Transfer</span><span className="font-medium text-primary">Rs {today.todayBT.toLocaleString()}</span></div>
              <div className="border-t my-1" />
              <div className="flex justify-between"><span className="text-muted-foreground">Avg Sale Value</span><span className="font-medium">{today.todaySalesCount > 0 ? `Rs ${Math.round(today.todaySales / today.todaySalesCount).toLocaleString()}` : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Profit Margin</span><span className={`font-medium ${today.todaySales > 0 && today.todayProfit >= 0 ? "text-green-600" : "text-destructive"}`}>{today.todaySales > 0 ? `${((today.todayProfit / today.todaySales) * 100).toFixed(1)}%` : "—"}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Legacy Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => (
          <motion.div key={card.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.3 }}>
            <Link to={card.link}>
              <Card className="group relative overflow-hidden transition-shadow hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{fmt(card.value, card.format)}</div>
                </CardContent>
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-accent opacity-0 transition-opacity group-hover:opacity-100" />
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {paymentData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card>
              <CardHeader><CardTitle className="text-base">Payment Method Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={12}>
                      {paymentData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`Rs ${v.toLocaleString()}`, "Amount"]} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(220, 13%, 91%)", fontSize: 13 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {topDebtors.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card>
              <CardHeader><CardTitle className="text-base">Top 10 Debtors</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={topDebtors} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <XAxis type="number" tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} fontSize={12} stroke="hsl(220, 9%, 46%)" />
                    <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="hsl(220, 9%, 46%)" />
                    <Tooltip formatter={(v: number) => [`Rs ${v.toLocaleString()}`, "Balance"]} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(220, 13%, 91%)", fontSize: 13 }} />
                    <Bar dataKey="balance" radius={[0, 4, 4, 0]}>
                      {topDebtors.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {breakdownData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card>
              <CardHeader><CardTitle className="text-base">Receivables Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={breakdownData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={12}>
                      {breakdownData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`Rs ${v.toLocaleString()}`, "Amount"]} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(220, 13%, 91%)", fontSize: 13 }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {stats.totalItems === 0 && stats.totalParties === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-12 rounded-lg border border-dashed p-8 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Get Started</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add items to your <Link to="/inventory" className="text-accent underline">inventory</Link>,
            or upload your <Link to="/receivables" className="text-accent underline">receivables</Link> and{" "}
            <Link to="/sales" className="text-accent underline">sales</Link> Excel files.
          </p>
        </motion.div>
      )}
    </div>
  );
}
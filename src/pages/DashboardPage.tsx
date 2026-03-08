import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Package, TrendingUp, AlertTriangle, ShoppingCart, Receipt, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
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
  const [lowStockProducts, setLowStockProducts] = useState<{ id: string; name: string; quantity: number; alert_threshold: number; purchase_price: number }[]>([]);
  const [today, setToday] = useState<TodaySummary>({ todaySales: 0, todayPurchases: 0, todayExpenses: 0, todayProfit: 0, todaySalesCount: 0, todayPurchasesCount: 0, todayExpensesCount: 0, todayJC: 0, todayEP: 0, todayBT: 0, todayCash: 0 });

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const fetchData = async () => {
      try {
        const [{ data: todaySales }, { data: todayPurchases }, { data: todayExpenses }, { data: products }] = await Promise.all([
          supabase.from("sale_transactions").select("total, payment_method").eq("date", todayStr),
          supabase.from("purchases").select("total").eq("date", todayStr),
          supabase.from("expenses").select("amount").eq("date", todayStr),
          supabase.from("products").select("id, name, quantity, alert_threshold, purchase_price"),
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
      } catch (e) {
        console.error("Dashboard fetch error:", e);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your shop operations</p>
      </div>

      {/* Low Stock Alerts */}
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
    </div>
  );
}

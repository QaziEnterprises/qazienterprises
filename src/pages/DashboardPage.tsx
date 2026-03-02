import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Package, Users, TrendingUp, ArrowDownRight, Banknote, ShoppingCart, Receipt, AlertTriangle, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const CHART_COLORS = [
  "hsl(38, 92%, 50%)", "hsl(222, 47%, 11%)", "hsl(142, 71%, 45%)",
  "hsl(0, 72%, 51%)", "hsl(220, 14%, 70%)", "hsl(280, 60%, 50%)",
];

interface LowStockItem { id: string; name: string; quantity: number; alert_threshold: number; }

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalProducts: 0, inventoryValue: 0,
    todaySales: 0, totalSales: 0, totalDue: 0,
    todayPurchases: 0, todayExpenses: 0,
    totalCustomers: 0, totalSuppliers: 0,
  });
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [paymentData, setPaymentData] = useState<{ name: string; value: number }[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];

        const [
          { data: products },
          { data: allSales },
          { data: todaySalesData },
          { data: todayPurchases },
          { data: todayExpenses },
          { data: customers },
          { data: suppliers },
        ] = await Promise.all([
          supabase.from("products").select("id, name, quantity, selling_price, purchase_price, alert_threshold"),
          supabase.from("sale_transactions").select("total, payment_status, payment_method, customer_id"),
          supabase.from("sale_transactions").select("total").eq("date", today),
          supabase.from("purchases").select("total").eq("date", today),
          supabase.from("expenses").select("amount").eq("date", today),
          supabase.from("contacts").select("id, name").eq("type", "customer"),
          supabase.from("contacts").select("id").eq("type", "supplier"),
        ]);

        const prods = products || [];
        const sales = allSales || [];

        // Stats
        const inventoryValue = prods.reduce((s, p) => s + (Number(p.quantity) || 0) * (Number(p.purchase_price) || 0), 0);
        const totalSalesAmount = sales.reduce((s, t) => s + Number(t.total), 0);
        const totalDueAmount = sales.filter(s => s.payment_status === "due" || s.payment_status === "partial").reduce((s, t) => s + Number(t.total), 0);
        const todaySalesTotal = (todaySalesData || []).reduce((s, t) => s + Number(t.total), 0);
        const todayPurchaseTotal = (todayPurchases || []).reduce((s, t) => s + Number(t.total), 0);
        const todayExpenseTotal = (todayExpenses || []).reduce((s, t) => s + Number(t.amount), 0);

        setStats({
          totalProducts: prods.length,
          inventoryValue,
          todaySales: todaySalesTotal,
          totalSales: totalSalesAmount,
          totalDue: totalDueAmount,
          todayPurchases: todayPurchaseTotal,
          todayExpenses: todayExpenseTotal,
          totalCustomers: (customers || []).length,
          totalSuppliers: (suppliers || []).length,
        });

        // Low stock
        const lowStockItems = prods.filter(p => p.alert_threshold && Number(p.alert_threshold) > 0 && Number(p.quantity) <= Number(p.alert_threshold));
        setLowStock(lowStockItems.map(p => ({ id: p.id, name: p.name, quantity: Number(p.quantity), alert_threshold: Number(p.alert_threshold) })));

        // Payment method breakdown
        const methods: Record<string, number> = {};
        sales.forEach(s => {
          const m = s.payment_method || "cash";
          methods[m] = (methods[m] || 0) + Number(s.total);
        });
        setPaymentData(Object.entries(methods).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })).filter(d => d.value > 0));

        // Top customers by sales
        const customerSales: Record<string, number> = {};
        sales.forEach(s => {
          if (s.customer_id) customerSales[s.customer_id] = (customerSales[s.customer_id] || 0) + Number(s.total);
        });
        const custMap = new Map((customers || []).map(c => [c.id, c.name]));
        const topCusts = Object.entries(customerSales)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8)
          .map(([id, total]) => ({ name: (custMap.get(id) || "Unknown").slice(0, 15), total }));
        setTopCustomers(topCusts);

      } catch (err) {
        console.error("Dashboard fetch error:", err);
        toast.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const fmt = (val: number) => `Rs ${val.toLocaleString()}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const cards = [
    { title: "Today's Sales", value: fmt(stats.todaySales), icon: ShoppingCart, color: "text-accent", link: "/pos" },
    { title: "Today's Purchases", value: fmt(stats.todayPurchases), icon: Receipt, color: "text-primary", link: "/purchases" },
    { title: "Today's Expenses", value: fmt(stats.todayExpenses), icon: DollarSign, color: "text-destructive", link: "/expenses" },
    { title: "Total Sales", value: fmt(stats.totalSales), icon: TrendingUp, color: "text-accent", link: "/bills" },
    { title: "Total Due", value: fmt(stats.totalDue), icon: ArrowDownRight, color: "text-destructive", link: "/bills" },
    { title: "Inventory Value", value: fmt(stats.inventoryValue), icon: Package, color: "text-primary", link: "/products-db" },
    { title: "Products", value: stats.totalProducts.toString(), icon: Package, color: "text-muted-foreground", link: "/products-db" },
    { title: "Customers", value: stats.totalCustomers.toString(), icon: Users, color: "text-accent", link: "/contacts" },
    { title: "Suppliers", value: stats.totalSuppliers.toString(), icon: Banknote, color: "text-muted-foreground", link: "/contacts" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your business operations</p>
      </div>

      {/* Low Stock Alerts */}
      {lowStock.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-destructive">Low Stock Alert ({lowStock.length} items)</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {lowStock.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded border bg-background p-2 text-sm">
                <span className="font-medium truncate">{item.name}</span>
                <span className="text-destructive font-bold shrink-0 ml-2">{item.quantity} left</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => (
          <motion.div key={card.title} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.3 }}>
            <Link to={card.link}>
              <Card className="group relative overflow-hidden transition-shadow hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
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

        {topCustomers.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card>
              <CardHeader><CardTitle className="text-base">Top Customers by Sales</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={topCustomers} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <XAxis type="number" tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`} fontSize={12} stroke="hsl(220, 9%, 46%)" />
                    <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="hsl(220, 9%, 46%)" />
                    <Tooltip formatter={(v: number) => [`Rs ${v.toLocaleString()}`, "Sales"]} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(220, 13%, 91%)", fontSize: 13 }} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {topCustomers.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {stats.totalProducts === 0 && stats.totalCustomers === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-12 rounded-lg border border-dashed p-8 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Get Started</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add <Link to="/products-db" className="text-accent underline">products</Link>,
            <Link to="/contacts" className="text-accent underline"> contacts</Link>, and start
            selling via <Link to="/pos" className="text-accent underline">POS</Link>.
          </p>
        </motion.div>
      )}
    </div>
  );
}

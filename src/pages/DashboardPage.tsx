import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Package, Users, FileSpreadsheet, TrendingUp, ArrowDownRight, Banknote, Smartphone, CreditCard, Building2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInventory, getReceivables, getSales } from "@/lib/store";
import { InventoryItem } from "@/types";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const CHART_COLORS = [
  "hsl(38, 92%, 50%)", "hsl(222, 47%, 11%)", "hsl(142, 71%, 45%)",
  "hsl(0, 72%, 51%)", "hsl(220, 14%, 70%)", "hsl(280, 60%, 50%)",
  "hsl(190, 80%, 45%)", "hsl(30, 80%, 55%)", "hsl(160, 60%, 40%)", "hsl(350, 70%, 55%)",
];

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalItems: 0, totalInventoryValue: 0, totalReceivables: 0,
    totalParties: 0, totalCashSales: 0, totalUnpaid: 0,
    totalJC: 0, totalEP: 0, totalBT: 0,
  });
  const [topDebtors, setTopDebtors] = useState<{ name: string; balance: number }[]>([]);
  const [breakdownData, setBreakdownData] = useState<{ name: string; value: number }[]>([]);
  const [paymentData, setPaymentData] = useState<{ name: string; value: number }[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
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

    // Payment method breakdown
    setPaymentData([
      { name: "Cash", value: totalCash },
      { name: "JazzCash", value: totalJC },
      { name: "EasyPaisa", value: totalEP },
      { name: "Bank Transfer", value: totalBT },
    ].filter((d) => d.value > 0));

    // Top debtors
    const debtors = recv
      .filter((r) => r.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10)
      .map((r) => ({ name: r.partyName.length > 15 ? r.partyName.slice(0, 15) + "…" : r.partyName, balance: r.balance }));
    setTopDebtors(debtors);

    // Receivables breakdown
    const positive = recv.filter((r) => r.balance > 0);
    const negative = recv.filter((r) => r.balance < 0);
    const zero = recv.filter((r) => r.balance === 0);
    setBreakdownData([
      { name: "Owed to You", value: positive.reduce((s, r) => s + r.balance, 0) },
      { name: "You Owe", value: Math.abs(negative.reduce((s, r) => s + r.balance, 0)) },
      { name: "Settled", value: zero.length },
    ].filter((d) => d.value > 0));

    // Low stock items
    const lowStock = inv.filter((item) => {
      const threshold = (item as any).alertThreshold;
      return threshold && threshold > 0 && item.quantity <= threshold;
    });
    setLowStockItems(lowStock);
  }, []);

  const cards = [
    { title: "Inventory Items", value: stats.totalItems, format: "number", icon: Package, link: "/inventory", color: "text-accent" },
    { title: "Inventory Value", value: stats.totalInventoryValue, format: "currency", icon: TrendingUp, link: "/inventory", color: "text-success" },
    { title: "Total Receivables", value: stats.totalReceivables, format: "currency", icon: Users, link: "/receivables", color: "text-accent" },
    { title: "Active Parties", value: stats.totalParties, format: "number", icon: Users, link: "/receivables", color: "text-muted-foreground" },
    { title: "Cash Sales", value: stats.totalCashSales, format: "currency", icon: Banknote, link: "/sales", color: "text-success" },
    { title: "JazzCash (JC)", value: stats.totalJC, format: "currency", icon: Smartphone, link: "/sales", color: "text-accent" },
    { title: "EasyPaisa (EP)", value: stats.totalEP, format: "currency", icon: CreditCard, link: "/sales", color: "text-success" },
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

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-lg border border-warning bg-warning/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h3 className="font-semibold text-warning">Low Stock Alert</h3>
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
        {/* Payment Method Breakdown */}
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

        {/* Top Debtors */}
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

        {/* Receivables Breakdown */}
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

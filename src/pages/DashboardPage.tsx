import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Package, Users, FileSpreadsheet, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getInventory, getReceivables, getSales } from "@/lib/store";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalItems: 0,
    totalInventoryValue: 0,
    totalReceivables: 0,
    totalParties: 0,
    totalCashSales: 0,
    totalUnpaid: 0,
  });

  useEffect(() => {
    const inv = getInventory();
    const recv = getReceivables();
    const sales = getSales();

    setStats({
      totalItems: inv.length,
      totalInventoryValue: inv.reduce((sum, i) => sum + i.quantity * i.price, 0),
      totalReceivables: recv.reduce((sum, r) => sum + r.balance, 0),
      totalParties: recv.length,
      totalCashSales: sales.reduce((sum, s) => sum + s.cash, 0),
      totalUnpaid: sales.reduce((sum, s) => sum + s.notPaid, 0),
    });
  }, []);

  const cards = [
    {
      title: "Inventory Items",
      value: stats.totalItems,
      format: "number",
      icon: Package,
      link: "/inventory",
      color: "text-accent",
    },
    {
      title: "Inventory Value",
      value: stats.totalInventoryValue,
      format: "currency",
      icon: TrendingUp,
      link: "/inventory",
      color: "text-success",
    },
    {
      title: "Total Receivables",
      value: stats.totalReceivables,
      format: "currency",
      icon: Users,
      link: "/receivables",
      color: "text-accent",
    },
    {
      title: "Active Parties",
      value: stats.totalParties,
      format: "number",
      icon: Users,
      link: "/receivables",
      color: "text-muted-foreground",
    },
    {
      title: "Cash Sales",
      value: stats.totalCashSales,
      format: "currency",
      icon: FileSpreadsheet,
      link: "/sales",
      color: "text-success",
    },
    {
      title: "Unpaid Amount",
      value: stats.totalUnpaid,
      format: "currency",
      icon: ArrowDownRight,
      link: "/sales",
      color: "text-destructive",
    },
  ];

  const fmt = (val: number, format: string) =>
    format === "currency" ? `Rs ${val.toLocaleString()}` : val.toLocaleString();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your shop operations</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <Link to={card.link}>
              <Card className="group relative overflow-hidden transition-shadow hover:shadow-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
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

      {stats.totalItems === 0 && stats.totalParties === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 rounded-lg border border-dashed p-8 text-center"
        >
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

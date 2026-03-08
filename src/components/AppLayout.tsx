import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, Users, FileSpreadsheet, Shield, LogOut, UserCircle, ShoppingCart, Receipt, CreditCard, Menu, X, Boxes, BarChart3, FileText, CalendarDays, BookOpen, ClipboardList, Wallet, StickyNote, BookMarked, Calculator, Cloud, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import LowStockAlerts from "@/components/LowStockAlerts";

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, role, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allNavItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard", adminOnly: false },
    { to: "/pos", icon: CreditCard, label: "POS", adminOnly: false },
    { to: "/bills", icon: FileText, label: "Bills & Invoices", adminOnly: false },
    { to: "/contacts", icon: UserCircle, label: "Contacts", adminOnly: false },
    { to: "/products-db", icon: Boxes, label: "Products", adminOnly: false },
    { to: "/purchases", icon: ShoppingCart, label: "Purchases", adminOnly: false },
    { to: "/expenses", icon: Receipt, label: "Expenses", adminOnly: false },
    { to: "/reports", icon: BarChart3, label: "Daily Reports", adminOnly: false },
    { to: "/cash-register", icon: Wallet, label: "Cash Register", adminOnly: false },
    { to: "/khata", icon: BookMarked, label: "Khata Book", adminOnly: false },
    { to: "/profit", icon: Calculator, label: "Profit Calculator", adminOnly: false },
    { to: "/todos", icon: StickyNote, label: "Quick Notes", adminOnly: false },
    { to: "/summary", icon: CalendarDays, label: "Monthly Summary", adminOnly: false },
    { to: "/inventory", icon: Package, label: "Inventory", adminOnly: false },
    { to: "/receivables", icon: Users, label: "Receivables", adminOnly: false },
    { to: "/sales", icon: FileSpreadsheet, label: "Sales Summary", adminOnly: false },
    { to: "/backup", icon: Cloud, label: "Google Backup", adminOnly: false },
    { to: "/ledger", icon: BookOpen, label: "Customer Ledger", adminOnly: true },
    { to: "/audit", icon: ClipboardList, label: "Audit Trail", adminOnly: true },
    { to: "/admin", icon: Shield, label: "Admin Panel", adminOnly: true },
  ];

  const navItems = allNavItems.filter((item) => !item.adminOnly || role === "admin");

  const sidebar = (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform",
      isMobile && !sidebarOpen && "-translate-x-full"
    )}>
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
        <div className="flex items-center gap-2">
          <Package className="h-7 w-7 text-sidebar-primary" />
          <span className="text-lg font-bold tracking-tight">Qazi Enterprises</span>
        </div>
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)} className="text-sidebar-muted hover:text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => isMobile && setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <p className="text-xs text-sidebar-muted mb-2 truncate">{user?.email}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start gap-2 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen">
      {isMobile && sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />}
      {sidebar}
      <main className={cn("flex-1", !isMobile && "pl-64")}>
        {isMobile && (
          <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4">
            <button onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></button>
            <span className="font-semibold">Qazi Enterprises</span>
          </div>
        )}
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

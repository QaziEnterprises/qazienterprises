import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, Users, FileSpreadsheet, Shield, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, role, signOut } = useAuth();

  const allNavItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard", adminOnly: true },
    { to: "/inventory", icon: Package, label: "Inventory", adminOnly: false },
    { to: "/receivables", icon: Users, label: "Receivables", adminOnly: false },
    { to: "/sales", icon: FileSpreadsheet, label: "Sales", adminOnly: true },
    { to: "/admin", icon: Shield, label: "Admin Panel", adminOnly: true },
  ];

  const navItems = allNavItems.filter((item) => !item.adminOnly || role === "admin");

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <Package className="h-7 w-7 text-sidebar-primary" />
          <span className="text-lg font-bold tracking-tight">ShopManager</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
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
      <main className="flex-1 pl-64">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

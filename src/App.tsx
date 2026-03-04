import { useEffect, useState, Component, ErrorInfo, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import InventoryPage from "@/pages/InventoryPage";
import ReceivablesPage from "@/pages/ReceivablesPage";
import SalesPage from "@/pages/SalesPage";
import LoginPage from "@/pages/LoginPage";
import AdminPage from "@/pages/AdminPage";
import ContactsPage from "@/pages/ContactsPage";
import ProductsPage from "@/pages/ProductsPage";
import PurchasesPage from "@/pages/PurchasesPage";
import ExpensesPage from "@/pages/ExpensesPage";
import POSPage from "@/pages/POSPage";
import ReportsPage from "@/pages/ReportsPage";
import BillsPage from "@/pages/BillsPage";
import NotFound from "./pages/NotFound";
import { initializeDefaultData } from "@/lib/store";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient();

// Global error boundary to prevent white screen
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App Error Boundary:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Something went wrong</h1>
          <p style={{ color: "#666", marginBottom: 16 }}>{this.state.error}</p>
          <button onClick={() => window.location.reload()} style={{ padding: "8px 24px", cursor: "pointer", background: "#f59e0b", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600 }}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && role !== "admin") return <Navigate to="/inventory" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, role, loading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeDefaultData()
      .then(() => setReady(true))
      .catch((err) => {
        console.error("Init error:", err);
        setReady(true); // Still show app even if init fails
      });
    // Safety timeout
    const timer = setTimeout(() => setReady(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !ready) {
    const showRecovery = ready && loading; // ready passed but auth still loading = stuck
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "#f59e0b", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
          <p style={{ color: "#666", marginBottom: 16 }}>Loading...</p>
          {showRecovery && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
              <button onClick={() => window.location.reload()} style={{ padding: "8px 24px", cursor: "pointer", background: "#f59e0b", border: "none", borderRadius: 6, color: "#fff", fontWeight: 600 }}>
                Retry
              </button>
              <button onClick={async () => { const { supabase: sb } = await import("@/integrations/supabase/client"); await sb.auth.signOut(); window.location.href = "/login"; }} style={{ padding: "6px 20px", cursor: "pointer", background: "transparent", border: "1px solid #ccc", borderRadius: 6, color: "#666", fontSize: 13 }}>
                Sign out &amp; return to login
              </button>
            </div>
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!user) return <Routes><Route path="/login" element={<LoginPage />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;

  return (
    <AppLayout>
      <Routes>
        <Route path="/login" element={<Navigate to={role === "admin" ? "/" : "/inventory"} replace />} />
        <Route path="/" element={<ProtectedRoute adminOnly>{role === "admin" ? <DashboardPage /> : <Navigate to="/inventory" replace />}</ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
        <Route path="/receivables" element={<ProtectedRoute><ReceivablesPage /></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute adminOnly><SalesPage /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute adminOnly><ContactsPage /></ProtectedRoute>} />
        <Route path="/products-db" element={<ProtectedRoute adminOnly><ProductsPage /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute adminOnly><PurchasesPage /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute adminOnly><ExpensesPage /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute adminOnly><POSPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute adminOnly><ReportsPage /></ProtectedRoute>} />
        <Route path="/bills" element={<ProtectedRoute adminOnly><BillsPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;

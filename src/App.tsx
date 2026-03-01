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
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// --- Error Boundary ---
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-background text-foreground">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground">An unexpected error occurred.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Loading Spinner ---
function FullScreenLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, role, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && role !== "admin") return <Navigate to="/inventory" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, role, loading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Safety timeout — force ready after 5s
    const timeout = setTimeout(() => {
      setReady((prev) => {
        if (!prev) console.warn("Init timed out, forcing ready");
        return true;
      });
    }, 5000);

    initializeDefaultData()
      .catch((err) => console.error("initializeDefaultData error:", err))
      .finally(() => {
        setReady(true);
        clearTimeout(timeout);
      });

    return () => clearTimeout(timeout);
  }, []);

  // Global unhandled rejection catcher
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", e.reason);
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
      e.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  if (loading || !ready) return <FullScreenLoader />;
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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

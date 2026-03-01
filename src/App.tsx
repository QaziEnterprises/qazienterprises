import { useEffect, useState } from "react";
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
    initializeDefaultData().then(() => setReady(true));
  }, []);

  if (loading || !ready) return null;
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
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

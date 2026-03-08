import { useState, useEffect, useRef, useMemo } from "react";
import {
  Search, X, Printer, Eye, FileText, Download, MessageCircle,
  Pencil, Trash2, ChevronLeft, ChevronRight, Filter, Receipt,
  DollarSign, AlertCircle, CheckCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { exportToExcel, printAsPDF } from "@/lib/exportUtils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { logAction } from "@/lib/auditLog";
import { supabase } from "@/integrations/supabase/client";
import { retryQuery, retryMutation } from "@/lib/retryFetch";
import { motion } from "framer-motion";
import EditBillDialog from "@/components/EditBillDialog";

interface SaleTransaction {
  id: string; invoice_no: string | null; date: string; customer_id: string | null;
  subtotal: number; discount: number; total: number; payment_method: string;
  payment_status: string; notes: string | null;
}

interface SaleItem {
  id: string; product_name: string; quantity: number; unit_price: number; subtotal: number;
}

interface Customer { id: string; name: string; }

const PAGE_SIZE = 15;

export default function BillsPage() {
  const { role } = useAuth();
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // View dialog
  const [selectedSale, setSelectedSale] = useState<SaleTransaction | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Edit dialog
  const [editSale, setEditSale] = useState<SaleTransaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Delete dialog
  const [deleteSale, setDeleteSale] = useState<SaleTransaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [{ data: s }, { data: c }] = await Promise.all([
          retryQuery(() => supabase.from("sale_transactions").select("*").order("created_at", { ascending: false })),
          retryQuery(() => supabase.from("contacts").select("id, name").eq("type", "customer")),
        ]);
        setSales(s || []);
        setCustomers(c || []);
      } catch (e) {
        console.error("Bills fetch error:", e);
        toast.error("Failed to load invoices");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getCustomerName = (id: string | null) =>
    customers.find((c) => c.id === id)?.name || "Walk-in Customer";

  const refreshSales = async () => {
    const { data } = await retryQuery(() => supabase.from("sale_transactions").select("*").order("created_at", { ascending: false }));
    setSales(data || []);
  };

  // Filtered data
  const filtered = useMemo(() => {
    let result = sales;
    if (statusFilter !== "all") {
      result = result.filter((s) => s.payment_status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.invoice_no?.toLowerCase().includes(q) ||
          getCustomerName(s.customer_id).toLowerCase().includes(q)
      );
    }
    return result;
  }, [sales, search, statusFilter, customers]);

  // Summary stats
  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((s, t) => s + Number(t.total), 0);
    const paidCount = sales.filter((s) => s.payment_status === "paid").length;
    const dueCount = sales.filter((s) => s.payment_status === "due").length;
    const partialCount = sales.filter((s) => s.payment_status === "partial").length;
    const dueAmount = sales.filter((s) => s.payment_status === "due" || s.payment_status === "partial")
      .reduce((s, t) => s + Number(t.total), 0);
    return { totalRevenue, paidCount, dueCount, partialCount, dueAmount };
  }, [sales]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const viewBill = async (sale: SaleTransaction) => {
    setSelectedSale(sale);
    const { data } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    setSaleItems(data || []);
    setDialogOpen(true);
  };

  const handlePrint = () => {
    if (!printRef.current || !selectedSale) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Invoice - ${selectedSale.invoice_no}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 20px; font-size: 12px; color: #222; }
        .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 12px; }
        .header h1 { font-size: 20px; }
        .header p { font-size: 11px; color: #555; }
        .info { display: flex; justify-content: space-between; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; }
        .footer { text-align: center; margin-top: 24px; font-size: 10px; color: #888; border-top: 1px dashed #ccc; padding-top: 8px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${printRef.current.innerHTML}
      <script>window.onload = function() { window.print(); window.close(); }<\/script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const handleWhatsApp = () => {
    if (!selectedSale || saleItems.length === 0) return;
    const customerName = getCustomerName(selectedSale.customer_id);
    const items = saleItems
      .map((item, i) => `${i + 1}. ${item.product_name} x${item.quantity} = Rs ${Number(item.subtotal).toLocaleString()}`)
      .join("\n");
    const msg = `*Qazi Enterprises - Invoice*\n\nInvoice: ${selectedSale.invoice_no}\nDate: ${selectedSale.date}\nCustomer: ${customerName}\n\n*Items:*\n${items}\n\nSubtotal: Rs ${Number(selectedSale.subtotal).toLocaleString()}${Number(selectedSale.discount) > 0 ? `\nDiscount: -Rs ${Number(selectedSale.discount).toLocaleString()}` : ""}\n*Total: Rs ${Number(selectedSale.total).toLocaleString()}*\nPayment: ${selectedSale.payment_method.toUpperCase()} (${selectedSale.payment_status})\n\nThank you for your business!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const statusColor = (s: string) =>
    s === "paid" ? "default" : s === "partial" ? "secondary" : "destructive";

  const handleDelete = async () => {
    if (!deleteSale) return;
    setDeleting(true);
    try {
      await retryMutation(() => supabase.from("sale_items").delete().eq("sale_id", deleteSale.id));
      const { error } = await retryMutation(() => supabase.from("sale_transactions").delete().eq("id", deleteSale.id));
      if (error) throw error;
      logAction("delete", "sale", deleteSale.id, `Deleted invoice ${deleteSale.invoice_no} - Rs ${Number(deleteSale.total).toLocaleString()}`);
      toast.success(`Invoice ${deleteSale.invoice_no} deleted`);
      setDeleteSale(null);
      refreshSales();
    } catch (e) {
      console.error("Delete bill error:", e);
      toast.error("Failed to delete invoice");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bills & Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {sales.length} total invoices · Showing {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" disabled={sales.length === 0} onClick={() => {
            exportToExcel(filtered.map((s) => ({
              Invoice: s.invoice_no || "", Date: s.date, Customer: getCustomerName(s.customer_id),
              Payment: s.payment_method, Status: s.payment_status, Total: Number(s.total),
            })), "bills_invoices", "Invoices");
            toast.success("Exported to Excel");
          }}>
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button size="sm" variant="outline" className="gap-2" disabled={sales.length === 0} onClick={() => {
            printAsPDF("Bills & Invoices",
              ["Invoice", "Date", "Customer", "Payment", "Status", "Total"],
              filtered.map((s) => [s.invoice_no || "—", s.date, getCustomerName(s.customer_id), s.payment_method, s.payment_status, `Rs ${Number(s.total).toLocaleString()}`])
            );
          }}>
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Invoices</p>
              <p className="text-xl font-bold">{sales.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Revenue</p>
              <p className="text-xl font-bold">Rs {stats.totalRevenue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Paid</p>
              <p className="text-xl font-bold">{stats.paidCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Due / Partial</p>
              <p className="text-xl font-bold">{stats.dueCount + stats.partialCount}</p>
              <p className="text-xs text-destructive">Rs {stats.dueAmount.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by invoice or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-10">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="due">Due</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
          Loading invoices...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-16 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground font-medium">No invoices found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {search || statusFilter !== "all" ? "Try adjusting your search or filters." : "Sales will appear here after processing through POS."}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-3 w-32 text-center font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((s, i) => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02, duration: 0.2 }}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-xs bg-muted px-2 py-0.5 rounded">
                        {s.invoice_no || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.date}</td>
                    <td className="px-4 py-3 font-medium">{getCustomerName(s.customer_id)}</td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-muted-foreground">{s.payment_method}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusColor(s.payment_status)} className="capitalize text-xs">
                        {s.payment_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      Rs {Number(s.total).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => viewBill(s)} title="View Invoice">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditSale(s); setEditOpen(true); }} title="Edit Invoice">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDeleteSale(s)} title="Delete Invoice">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1]) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`dots-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                  ) : (
                    <Button
                      key={p}
                      size="sm"
                      variant={p === currentPage ? "default" : "outline"}
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => setPage(p as number)}
                    >
                      {p}
                    </Button>
                  )
                )}
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Invoice Preview Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Invoice {selectedSale?.invoice_no}</span>
              <div className="flex gap-2">
                {role === "admin" && (
                  <Button size="sm" variant="outline" className="gap-2" onClick={handleWhatsApp}>
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}>
                  <Printer className="h-4 w-4" /> Print
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div ref={printRef}>
              <div style={{ textAlign: "center", marginBottom: 16, borderBottom: "2px solid #000", paddingBottom: 12 }}>
                <h1 style={{ fontSize: 20 }}>Qazi Enterprises</h1>
                <p style={{ fontSize: 11, color: "#555" }}>Your trusted business partner</p>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 12 }}>
                <div>
                  <p><strong>Invoice:</strong> {selectedSale.invoice_no}</p>
                  <p><strong>Customer:</strong> {getCustomerName(selectedSale.customer_id)}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p><strong>Date:</strong> {selectedSale.date}</p>
                  <p><strong>Payment:</strong> {selectedSale.payment_method.toUpperCase()} ({selectedSale.payment_status})</p>
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #000" }}>
                    <th style={{ textAlign: "left", padding: "6px 4px" }}>#</th>
                    <th style={{ textAlign: "left", padding: "6px 4px" }}>Product</th>
                    <th style={{ textAlign: "right", padding: "6px 4px" }}>Qty</th>
                    <th style={{ textAlign: "right", padding: "6px 4px" }}>Price</th>
                    <th style={{ textAlign: "right", padding: "6px 4px" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {saleItems.map((item, i) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #ddd" }}>
                      <td style={{ padding: "6px 4px" }}>{i + 1}</td>
                      <td style={{ padding: "6px 4px" }}>{item.product_name}</td>
                      <td style={{ textAlign: "right", padding: "6px 4px" }}>{item.quantity}</td>
                      <td style={{ textAlign: "right", padding: "6px 4px" }}>Rs {Number(item.unit_price).toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "6px 4px" }}>Rs {Number(item.subtotal).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginLeft: "auto", width: 220, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span>Subtotal:</span><span>Rs {Number(selectedSale.subtotal).toLocaleString()}</span>
                </div>
                {Number(selectedSale.discount) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "red" }}>
                    <span>Discount:</span><span>-Rs {Number(selectedSale.discount).toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", borderTop: "2px solid #000", fontWeight: 700, fontSize: 16 }}>
                  <span>Total:</span><span>Rs {Number(selectedSale.total).toLocaleString()}</span>
                </div>
              </div>
              <div style={{ textAlign: "center", marginTop: 24, fontSize: 10, color: "#888", borderTop: "1px dashed #ccc", paddingTop: 8 }}>
                <p>Thank you for your business!</p>
                <p>Qazi Enterprises — All rights reserved</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Bill Dialog */}
      {editSale && (
        <EditBillDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          sale={editSale}
          customers={customers}
          onSaved={refreshSales}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteSale} onOpenChange={(open) => { if (!open) setDeleteSale(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice {deleteSale?.invoice_no}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this invoice and all its line items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

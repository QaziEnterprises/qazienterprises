import { useState, useEffect, useRef } from "react";
import { Search, X, Printer, Eye, FileText, Download, MessageCircle, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { exportToExcel, printAsPDF } from "@/lib/exportUtils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
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

export default function BillsPage() {
  const { role } = useAuth();
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<SaleTransaction | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [{ data: s }, { data: c }] = await Promise.all([
          supabase.from("sale_transactions").select("*").order("created_at", { ascending: false }),
          supabase.from("contacts").select("id, name").eq("type", "customer"),
        ]);
        setSales(s || []);
        setCustomers(c || []);
      } catch (e) {
        console.error("Bills fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getCustomerName = (id: string | null) => customers.find((c) => c.id === id)?.name || "Walk-in Customer";

  const filtered = sales.filter((s) =>
    s.invoice_no?.toLowerCase().includes(search.toLowerCase()) ||
    getCustomerName(s.customer_id).toLowerCase().includes(search.toLowerCase())
  );

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
      <script>window.onload = function() { window.print(); window.close(); }</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const handleWhatsApp = () => {
    if (!selectedSale || saleItems.length === 0) return;
    const customerName = getCustomerName(selectedSale.customer_id);
    const items = saleItems.map((item, i) => `${i + 1}. ${item.product_name} x${item.quantity} = Rs ${Number(item.subtotal).toLocaleString()}`).join("\n");
    const msg = `*Qazi Enterprises - Invoice*\n\nInvoice: ${selectedSale.invoice_no}\nDate: ${selectedSale.date}\nCustomer: ${customerName}\n\n*Items:*\n${items}\n\nSubtotal: Rs ${Number(selectedSale.subtotal).toLocaleString()}${Number(selectedSale.discount) > 0 ? `\nDiscount: -Rs ${Number(selectedSale.discount).toLocaleString()}` : ""}\n*Total: Rs ${Number(selectedSale.total).toLocaleString()}*\nPayment: ${selectedSale.payment_method.toUpperCase()} (${selectedSale.payment_status})\n\nThank you for your business!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const statusColor = (s: string) => s === "paid" ? "default" : s === "partial" ? "secondary" : "destructive";

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bills & Invoices</h1>
          <p className="text-sm text-muted-foreground">{sales.length} total invoices</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" disabled={sales.length === 0} onClick={() => {
            exportToExcel(filtered.map(s => ({
              Invoice: s.invoice_no || "", Date: s.date, Customer: getCustomerName(s.customer_id),
              Payment: s.payment_method, Status: s.payment_status, Total: Number(s.total),
            })), "bills_invoices", "Invoices");
            toast.success("Exported to Excel");
          }}><Download className="h-4 w-4" /> Excel</Button>
          <Button size="sm" variant="outline" className="gap-2" disabled={sales.length === 0} onClick={() => {
            printAsPDF("Bills & Invoices",
              ["Invoice", "Date", "Customer", "Payment", "Status", "Total"],
              filtered.map(s => [s.invoice_no || "—", s.date, getCustomerName(s.customer_id), s.payment_method, s.payment_status, `Rs ${Number(s.total).toLocaleString()}`])
            );
          }}><Download className="h-4 w-4" /> PDF</Button>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by invoice or customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">No invoices found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Invoice</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                <th className="px-4 py-3 w-24 text-center font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{s.invoice_no || "—"}</td>
                  <td className="px-4 py-3">{s.date}</td>
                  <td className="px-4 py-3">{getCustomerName(s.customer_id)}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{s.payment_method}</td>
                  <td className="px-4 py-3"><Badge variant={statusColor(s.payment_status)}>{s.payment_status}</Badge></td>
                  <td className="px-4 py-3 text-right font-bold">Rs {Number(s.total).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => viewBill(s)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice Preview Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Invoice {selectedSale?.invoice_no}
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
              <div className="header" style={{ textAlign: "center", marginBottom: 16, borderBottom: "2px solid #000", paddingBottom: 12 }}>
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
    </div>
  );
}

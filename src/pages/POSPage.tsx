import { useState, useEffect, useRef } from "react";
import { Search, X, ShoppingBag, Plus, Minus, Trash2, CreditCard, Printer, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { logAction } from "@/lib/auditLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { NumberInput } from "@/components/NumberInput";

interface Product { id: string; name: string; selling_price: number; quantity: number; sku: string | null; }
interface Customer { id: string; name: string; }
interface CartItem { product_id: string; name: string; quantity: number; unit_price: number; subtotal: number; max_stock: number; }

interface SaleInvoice {
  invoice_no: string;
  date: string;
  customer_name: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  payment_status: string;
}

export default function POSPage() {
  const { role } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [invoiceData, setInvoiceData] = useState<SaleInvoice | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: prods }, { data: custs }] = await Promise.all([
          supabase.from("products").select("id, name, selling_price, quantity, sku").order("name"),
          supabase.from("contacts").select("id, name").eq("type", "customer").order("name"),
        ]);
        setProducts(prods || []);
        setCustomers(custs || []);
      } catch (e) {
        console.error("POS fetch error:", e);
        toast.error("Failed to load POS data");
      }
    };
    fetchData();
  }, []);

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: Product) => {
    const existing = cart.find((c) => c.product_id === product.id);
    if (existing) {
      if (existing.quantity >= product.quantity) { toast.error("Not enough stock"); return; }
      setCart(cart.map((c) => c.product_id === product.id ? { ...c, quantity: c.quantity + 1, subtotal: (c.quantity + 1) * c.unit_price } : c));
    } else {
      if (product.quantity <= 0) { toast.error("Out of stock"); return; }
      setCart([...cart, { product_id: product.id, name: product.name, quantity: 1, unit_price: product.selling_price, subtotal: product.selling_price, max_stock: product.quantity }]);
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(cart.map((c) => {
      if (c.product_id !== productId) return c;
      const newQty = Math.max(1, Math.min(c.max_stock, c.quantity + delta));
      return { ...c, quantity: newQty, subtotal: newQty * c.unit_price };
    }));
  };

  const removeFromCart = (productId: string) => setCart(cart.filter((c) => c.product_id !== productId));

  const subtotal = cart.reduce((s, c) => s + c.subtotal, 0);
  const total = subtotal - discount;

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    setProcessing(true);

    const { data: sale, error } = await supabase.from("sale_transactions").insert({
      customer_id: customerId || null,
      subtotal,
      discount,
      total,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      notes: notes || null,
    }).select().single();

    if (error || !sale) { toast.error("Failed to process sale"); setProcessing(false); return; }

    const items = cart.map((c) => ({ sale_id: sale.id, product_id: c.product_id, product_name: c.name, quantity: c.quantity, unit_price: c.unit_price, subtotal: c.subtotal }));
    await supabase.from("sale_items").insert(items);

    // Deduct stock
    for (const item of cart) {
      const prod = products.find((p) => p.id === item.product_id);
      if (prod) await supabase.from("products").update({ quantity: prod.quantity - item.quantity }).eq("id", item.product_id);
    }

    // Build invoice data
    const customerName = customerId ? customers.find(c => c.id === customerId)?.name || "Walk-in Customer" : "Walk-in Customer";
    setInvoiceData({
      invoice_no: sale.invoice_no || "N/A",
      date: sale.date,
      customer_name: customerName,
      items: [...cart],
      subtotal,
      discount,
      total,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
    });
    setInvoiceDialogOpen(true);

    toast.success(`Sale completed! Invoice: ${sale.invoice_no}`);
    logAction("create", "sale", sale.id, `Sale ${sale.invoice_no} - Rs ${total} (${paymentMethod})`);
    setCart([]);
    setDiscount(0);
    setNotes("");
    setCustomerId("");
    setProcessing(false);

    const { data: prods } = await supabase.from("products").select("id, name, selling_price, quantity, sku").order("name");
    setProducts(prods || []);
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Please allow popups to print"); return; }
    printWindow.document.write(`
      <html><head><title>Invoice - ${invoiceData?.invoice_no}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 20px; font-size: 12px; color: #222; }
        .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #000; padding-bottom: 12px; }
        .header h1 { font-size: 20px; margin-bottom: 2px; }
        .header p { font-size: 11px; color: #555; }
        .info { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        .text-right { text-align: right; }
        .totals { margin-left: auto; width: 250px; }
        .totals td { border: none; padding: 3px 8px; }
        .totals .grand-total td { font-size: 16px; font-weight: 700; border-top: 2px solid #000; padding-top: 8px; }
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
    if (!invoiceData) return;
    const items = invoiceData.items.map((item, i) => `${i + 1}. ${item.name} x${item.quantity} = Rs ${item.subtotal.toLocaleString()}`).join("\n");
    const msg = `*Qazi Enterprises - Invoice*\n\nInvoice: ${invoiceData.invoice_no}\nDate: ${invoiceData.date}\nCustomer: ${invoiceData.customer_name}\n\n*Items:*\n${items}\n\nSubtotal: Rs ${invoiceData.subtotal.toLocaleString()}${invoiceData.discount > 0 ? `\nDiscount: -Rs ${invoiceData.discount.toLocaleString()}` : ""}\n*Total: Rs ${invoiceData.total.toLocaleString()}*\nPayment: ${invoiceData.payment_method.toUpperCase()} (${invoiceData.payment_status})\n\nThank you for your business!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };


  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)]">
      {/* Product List */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold tracking-tight">Point of Sale</h1>
            <Button variant="outline" className="lg:hidden gap-2" onClick={() => setShowCart(!showCart)}>
              <ShoppingBag className="h-4 w-4" /> Cart ({cart.length})
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start ${showCart ? "hidden lg:grid" : ""}`}>
          {filteredProducts.map((p) => (
            <motion.button
              key={p.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => addToCart(p)}
              className={`rounded-lg border p-3 text-left transition-colors hover:bg-accent ${p.quantity <= 0 ? "opacity-50" : ""}`}
            >
              <div className="font-medium text-sm truncate">{p.name}</div>
              {p.sku && <div className="text-xs text-muted-foreground">{p.sku}</div>}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-bold">Rs {Number(p.selling_price).toLocaleString()}</span>
                <Badge variant={p.quantity <= 0 ? "destructive" : "secondary"} className="text-xs">{p.quantity} left</Badge>
              </div>
            </motion.button>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {search ? "No products match your search." : "No products available. Add products first."}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <Card className={`w-full lg:w-96 flex flex-col shrink-0 ${showCart ? "" : "hidden lg:flex"}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Cart ({cart.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-2 mb-3">
            <AnimatePresence>
              {cart.map((item) => (
                <motion.div key={item.product_id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex items-center gap-2 rounded-lg border p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Rs {item.unit_price.toLocaleString()} × {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(item.product_id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <Button size="icon" variant="outline" className="h-6 w-6" onClick={() => updateQty(item.product_id, 1)}><Plus className="h-3 w-3" /></Button>
                  </div>
                  <div className="text-right w-20">
                    <p className="text-sm font-bold">Rs {item.subtotal.toLocaleString()}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => removeFromCart(item.product_id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                </motion.div>
              ))}
            </AnimatePresence>
            {cart.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Add products to cart</p>}
          </div>

          <Separator className="mb-3" />

          <div className="space-y-3">
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Walk-in Customer" /></SelectTrigger>
              <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>

            <div className="flex gap-2">
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="jazzcash">JazzCash</SelectItem>
                  <SelectItem value="easypaisa">EasyPaisa</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="due">Due</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Discount:</Label>
              <NumberInput value={discount} onValueChange={setDiscount} className="h-8 text-xs" />
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>Rs {subtotal.toLocaleString()}</span></div>
              {discount > 0 && <div className="flex justify-between text-destructive"><span>Discount</span><span>-Rs {discount.toLocaleString()}</span></div>}
              <Separator />
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span>Rs {total.toLocaleString()}</span></div>
            </div>

            <Button className="w-full gap-2" size="lg" onClick={handleCheckout} disabled={cart.length === 0 || processing}>
              <CreditCard className="h-4 w-4" /> {processing ? "Processing..." : "Complete Sale"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Print Dialog */}
      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Invoice Preview
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
          {invoiceData && (
            <div ref={printRef}>
              <div className="header">
                <h1>Qazi Enterprises</h1>
                <p>Your trusted business partner</p>
              </div>
              <div className="info" style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 12 }}>
                <div>
                  <p><strong>Invoice:</strong> {invoiceData.invoice_no}</p>
                  <p><strong>Customer:</strong> {invoiceData.customer_name}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p><strong>Date:</strong> {invoiceData.date}</p>
                  <p><strong>Payment:</strong> {invoiceData.payment_method.toUpperCase()} ({invoiceData.payment_status})</p>
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
                  {invoiceData.items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
                      <td style={{ padding: "6px 4px" }}>{i + 1}</td>
                      <td style={{ padding: "6px 4px" }}>{item.name}</td>
                      <td style={{ textAlign: "right", padding: "6px 4px" }}>{item.quantity}</td>
                      <td style={{ textAlign: "right", padding: "6px 4px" }}>Rs {item.unit_price.toLocaleString()}</td>
                      <td style={{ textAlign: "right", padding: "6px 4px" }}>Rs {item.subtotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginLeft: "auto", width: 220, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span>Subtotal:</span><span>Rs {invoiceData.subtotal.toLocaleString()}</span>
                </div>
                {invoiceData.discount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "red" }}>
                    <span>Discount:</span><span>-Rs {invoiceData.discount.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", borderTop: "2px solid #000", fontWeight: 700, fontSize: 16 }}>
                  <span>Total:</span><span>Rs {invoiceData.total.toLocaleString()}</span>
                </div>
              </div>
              <div className="footer" style={{ textAlign: "center", marginTop: 24, fontSize: 10, color: "#888", borderTop: "1px dashed #ccc", paddingTop: 8 }}>
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

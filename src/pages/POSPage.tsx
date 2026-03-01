import { useState, useEffect, useRef } from "react";
import { Search, X, ShoppingBag, Plus, Minus, Trash2, CreditCard, Printer } from "lucide-react";
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
  customer_type: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  payment_status: string;
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState("walk-in");
  const [customerType, setCustomerType] = useState("walk-in");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [invoiceData, setInvoiceData] = useState<SaleInvoice | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: prods }, { data: custs }] = await Promise.all([
        supabase.from("products").select("id, name, selling_price, quantity, sku").order("name"),
        supabase.from("contacts").select("id, name").eq("type", "customer").order("name"),
      ]);
      setProducts(prods || []);
      setCustomers(custs || []);
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
  const total = Math.max(0, subtotal - discount);

  const handleCheckout = async () => {
    if (cart.length === 0) { toast.error("Cart is empty"); return; }
    setProcessing(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const actualCustomerId = customerId === "walk-in" ? null : customerId;
      
      const { data: sale, error } = await supabase.from("sale_transactions").insert({
        customer_id: actualCustomerId,
        customer_type: customerType,
        subtotal,
        discount,
        total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        notes: notes || null,
        created_by: currentUser?.id || null,
      }).select().single();

      if (error || !sale) { toast.error("Failed to process sale: " + (error?.message || "Unknown error")); setProcessing(false); return; }

      const items = cart.map((c) => ({ sale_id: sale.id, product_id: c.product_id, product_name: c.name, quantity: c.quantity, unit_price: c.unit_price, subtotal: c.subtotal }));
      const { error: itemsError } = await supabase.from("sale_items").insert(items);
      if (itemsError) { toast.error("Failed to save sale items"); setProcessing(false); return; }

      // Deduct stock
      for (const item of cart) {
        const { data: currentProd } = await supabase.from("products").select("quantity").eq("id", item.product_id).single();
        if (currentProd) {
          await supabase.from("products").update({ quantity: Math.max(0, Number(currentProd.quantity) - item.quantity) }).eq("id", item.product_id);
        }
      }

      const customerName = actualCustomerId ? customers.find(c => c.id === actualCustomerId)?.name || "Walk-in Customer" : "Walk-in Customer";
      setInvoiceData({
        invoice_no: sale.invoice_no || "N/A",
        date: sale.date,
        customer_name: customerName,
        customer_type: customerType,
        items: [...cart],
        subtotal,
        discount,
        total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
      });
      setInvoiceDialogOpen(true);

      toast.success(`Sale completed! Invoice: ${sale.invoice_no}`);
      setCart([]);
      setDiscount(0);
      setNotes("");
      setCustomerId("walk-in");
      setCustomerType("walk-in");

      const { data: prods } = await supabase.from("products").select("id, name, selling_price, quantity, sku").order("name");
      setProducts(prods || []);
    } catch (err) {
      toast.error("Checkout failed");
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Please allow popups to print"); return; }
    const content = printRef.current.cloneNode(true) as HTMLElement;
    content.querySelectorAll("script").forEach((s) => s.remove());
    printWindow.document.write(`
      <html><head><title>Invoice - ${invoiceData?.invoice_no?.replace(/[<>"'&]/g, '')}</title>
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
      </style></head><body></body></html>
    `);
    printWindow.document.body.appendChild(printWindow.document.adoptNode(content));
    const s = printWindow.document.createElement("script");
    s.textContent = "window.onload = function() { window.print(); window.close(); }";
    printWindow.document.body.appendChild(s);
    printWindow.document.close();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)]">
      {/* Product List */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight mb-2">Point of Sale</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products by name or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
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
      <Card className="w-full lg:w-96 flex flex-col shrink-0">
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
            {/* Customer Type */}
            <div className="flex gap-2">
              <Select value={customerType} onValueChange={(val) => {
                setCustomerType(val);
                if (val === "walk-in") setCustomerId("walk-in");
              }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Customer Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">Walk-in</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer Selection (shown for non-walk-in) */}
            {customerType !== "walk-in" && (
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Customer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="walk-in">No specific customer</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <div className="flex gap-2">
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
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

            <div>
              <Label className="text-xs">Notes (optional)</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sale notes..." className="h-8 text-xs mt-1" />
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
              <Button size="sm" variant="outline" className="gap-2" onClick={handlePrint}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </DialogTitle>
          </DialogHeader>
          {invoiceData && (
            <div ref={printRef}>
              <div style={{ textAlign: "center", marginBottom: 16, borderBottom: "2px solid #000", paddingBottom: 12 }}>
                <h1 style={{ fontSize: 20 }}>Qazi Enterprises</h1>
                <p style={{ fontSize: 11, color: "#555" }}>Your trusted business partner</p>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 12 }}>
                <div>
                  <p><strong>Invoice:</strong> {invoiceData.invoice_no}</p>
                  <p><strong>Customer:</strong> {invoiceData.customer_name}</p>
                  <p><strong>Type:</strong> {invoiceData.customer_type.charAt(0).toUpperCase() + invoiceData.customer_type.slice(1)}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p><strong>Date:</strong> {invoiceData.date}</p>
                  <p><strong>Payment:</strong> {invoiceData.payment_method.toUpperCase()}</p>
                  <p><strong>Status:</strong> {invoiceData.payment_status.toUpperCase()}</p>
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

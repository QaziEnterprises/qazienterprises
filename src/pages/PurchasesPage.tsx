import { useState, useEffect } from "react";
import { Plus, Search, X, ShoppingCart, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { logAction } from "@/lib/auditLog";
import { NumberInput } from "@/components/NumberInput";

interface Purchase {
  id: string; supplier_id: string | null; date: string; reference_no: string | null;
  total: number; discount: number; payment_status: string; payment_method: string;
  notes: string | null; created_at: string;
}

interface Supplier { id: string; name: string; }
interface Product { id: string; name: string; purchase_price: number; quantity: number; }
interface CartItem { product_id: string; product_name: string; quantity: number; unit_price: number; subtotal: number; }

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [supplierId, setSupplierId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [refNo, setRefNo] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("due");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discount, setDiscount] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [qty, setQty] = useState(1);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: purch }, { data: supps }, { data: prods }] = await Promise.all([
        supabase.from("purchases").select("*").order("date", { ascending: false }),
        supabase.from("contacts").select("id, name").eq("type", "supplier").order("name"),
        supabase.from("products").select("id, name, purchase_price, quantity").order("name"),
      ]);
      setPurchases(purch || []);
      setSuppliers(supps || []);
      setProducts(prods || []);
    } catch (e) {
      console.error("Purchases fetch error:", e);
      toast.error("Failed to load purchases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = purchases.filter((p) =>
    p.reference_no?.toLowerCase().includes(search.toLowerCase()) ||
    suppliers.find((s) => s.id === p.supplier_id)?.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = () => {
    const prod = products.find((p) => p.id === selectedProduct);
    if (!prod) return;
    const existing = cart.find((c) => c.product_id === prod.id);
    if (existing) {
      setCart(cart.map((c) => c.product_id === prod.id ? { ...c, quantity: c.quantity + qty, subtotal: (c.quantity + qty) * c.unit_price } : c));
    } else {
      setCart([...cart, { product_id: prod.id, product_name: prod.name, quantity: qty, unit_price: prod.purchase_price, subtotal: qty * prod.purchase_price }]);
    }
    setSelectedProduct("");
    setQty(1);
  };

  const cartTotal = cart.reduce((s, c) => s + c.subtotal, 0) - discount;

  const handleSave = async () => {
    if (cart.length === 0) { toast.error("Add at least one product"); return; }
    const { data: purchase, error } = await supabase.from("purchases").insert({
      supplier_id: supplierId || null, date, reference_no: refNo || null,
      total: cartTotal, discount, payment_status: paymentStatus, payment_method: paymentMethod,
    }).select().single();

    if (error || !purchase) { toast.error("Failed to create purchase"); return; }

    const items = cart.map((c) => ({ purchase_id: purchase.id, product_id: c.product_id, quantity: c.quantity, unit_price: c.unit_price, subtotal: c.subtotal }));
    const { error: itemsErr } = await supabase.from("purchase_items").insert(items);
    if (itemsErr) { toast.error("Failed to save items"); return; }

    // Update product stock
    for (const item of cart) {
      const prod = products.find((p) => p.id === item.product_id);
      if (prod) {
        await supabase.from("products").update({ quantity: prod.quantity + item.quantity }).eq("id", item.product_id);
      }
    }

    toast.success("Purchase recorded");
    setDialogOpen(false); setCart([]); setSupplierId(""); setRefNo(""); setDiscount(0);
    fetchData();
  };

  const getSupplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name || "Walk-in";
  const statusColor = (s: string) => s === "paid" ? "default" : s === "partial" ? "secondary" : "destructive";

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground">{purchases.length} purchase orders</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New Purchase</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Supplier</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                    <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Reference No</Label><Input value={refNo} onChange={(e) => setRefNo(e.target.value)} /></div>
                <div className="space-y-1">
                  <Label>Payment Status</Label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="due">Due</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="jazzcash">JazzCash</SelectItem>
                      <SelectItem value="easypaisa">EasyPaisa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border rounded-lg p-3 space-y-3">
                <h4 className="font-semibold text-sm">Add Products</h4>
                <div className="flex gap-2">
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                    <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — Rs {p.purchase_price}</SelectItem>)}</SelectContent>
                  </Select>
                  <NumberInput value={qty} onValueChange={setQty} className="w-20" min={1} />
                  <Button onClick={addToCart} disabled={!selectedProduct}>Add</Button>
                </div>
                {cart.length > 0 && (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b"><th className="text-left py-1">Product</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Price</th><th className="text-right py-1">Subtotal</th><th className="w-8"></th></tr></thead>
                    <tbody>
                      {cart.map((c, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-1">{c.product_name}</td>
                          <td className="text-right py-1">{c.quantity}</td>
                          <td className="text-right py-1">Rs {c.unit_price.toLocaleString()}</td>
                          <td className="text-right py-1">Rs {c.subtotal.toLocaleString()}</td>
                          <td><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCart(cart.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="flex justify-between items-center">
                  <div className="space-y-1"><Label className="text-xs">Discount</Label><NumberInput value={discount} onValueChange={setDiscount} className="w-32 h-8" /></div>
                  <div className="text-right"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">Rs {cartTotal.toLocaleString()}</p></div>
                </div>
              </div>

              <Button onClick={handleSave} className="gap-2"><Save className="h-4 w-4" /> Save Purchase</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search purchases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">No purchases yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Supplier</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ref No</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">{p.date}</td>
                  <td className="px-4 py-3 font-medium">{getSupplierName(p.supplier_id)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.reference_no || "—"}</td>
                  <td className="px-4 py-3"><Badge variant={statusColor(p.payment_status)}>{p.payment_status}</Badge></td>
                  <td className="px-4 py-3 text-right font-medium">Rs {Number(p.total).toLocaleString()}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

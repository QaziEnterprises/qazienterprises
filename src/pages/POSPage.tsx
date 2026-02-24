import { useState, useEffect, useRef } from "react";
import { Search, X, ShoppingBag, Plus, Minus, Trash2, CreditCard, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Product { id: string; name: string; selling_price: number; quantity: number; sku: string | null; }
interface Customer { id: string; name: string; }
interface CartItem { product_id: string; name: string; quantity: number; unit_price: number; subtotal: number; max_stock: number; }

export default function POSPage() {
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
  const [lastInvoice, setLastInvoice] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: prods }, { data: custs }] = await Promise.all([
        supabase.from("products").select("id, name, selling_price, quantity, sku").order("name"),
        supabase.from("contacts").select("id, name").eq("type", "customer").order("name"),
      ]);
      setProducts(prods || []);
      setCustomers(custs || []);
    };
    fetch();
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

    setLastInvoice(sale.invoice_no);
    toast.success(`Sale completed! Invoice: ${sale.invoice_no}`);
    setCart([]);
    setDiscount(0);
    setNotes("");
    setCustomerId("");
    setProcessing(false);

    // Refresh products
    const { data: prods } = await supabase.from("products").select("id, name, selling_price, quantity, sku").order("name");
    setProducts(prods || []);
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-6rem)]">
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
        </div>
      </div>

      {/* Cart */}
      <Card className="w-96 flex flex-col shrink-0">
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
              <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="h-8 text-xs" />
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

            {lastInvoice && (
              <p className="text-xs text-center text-muted-foreground">Last invoice: {lastInvoice}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

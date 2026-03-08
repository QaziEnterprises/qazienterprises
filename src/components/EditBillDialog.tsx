import { useState, useEffect } from "react";
import { Pencil, Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAction } from "@/lib/auditLog";
import { NumberInput } from "@/components/NumberInput";

interface SaleTransaction {
  id: string; invoice_no: string | null; date: string; customer_id: string | null;
  subtotal: number; discount: number; total: number; payment_method: string;
  payment_status: string; notes: string | null;
}

interface SaleItem {
  id: string; product_name: string; quantity: number; unit_price: number; subtotal: number;
  product_id?: string | null;
}

interface Customer { id: string; name: string; }

interface EditBillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: SaleTransaction;
  customers: Customer[];
  onSaved: () => void;
}

export default function EditBillDialog({ open, onOpenChange, sale, customers, onSaved }: EditBillDialogProps) {
  const [customerId, setCustomerId] = useState(sale.customer_id || "walk-in");
  const [paymentMethod, setPaymentMethod] = useState(sale.payment_method);
  const [paymentStatus, setPaymentStatus] = useState(sale.payment_status);
  const [discount, setDiscount] = useState(Number(sale.discount));
  const [notes, setNotes] = useState(sale.notes || "");
  const [items, setItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerId(sale.customer_id || "walk-in");
      setPaymentMethod(sale.payment_method);
      setPaymentStatus(sale.payment_status);
      setDiscount(Number(sale.discount));
      setNotes(sale.notes || "");
      fetchItems();
    }
  }, [open, sale.id]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index: number, field: "product_name" | "quantity" | "unit_price", value: string | number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      updated.subtotal = Number(updated.quantity) * Number(updated.unit_price);
      return updated;
    }));
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) { toast.error("Invoice must have at least one item"); return; }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: `new-${Date.now()}`,
      product_name: "",
      quantity: 1,
      unit_price: 0,
      subtotal: 0,
      product_id: null,
    }]);
  };

  const subtotal = items.reduce((s, item) => s + Number(item.subtotal), 0);
  const total = subtotal - discount;

  const handleSave = async () => {
    if (items.some(item => !item.product_name.trim())) {
      toast.error("All items must have a product name");
      return;
    }
    if (items.some(item => Number(item.quantity) <= 0 || Number(item.unit_price) <= 0)) {
      toast.error("Quantity and price must be greater than 0");
      return;
    }

    setSaving(true);
    try {
      // Update transaction
      const { error: txError } = await supabase.from("sale_transactions").update({
        customer_id: customerId === "walk-in" ? null : customerId,
        subtotal,
        discount,
        total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        notes: notes || null,
      }).eq("id", sale.id);

      if (txError) throw txError;

      // Delete existing items and re-insert
      await supabase.from("sale_items").delete().eq("sale_id", sale.id);
      const newItems = items.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id || null,
        product_name: item.product_name,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        subtotal: Number(item.subtotal),
      }));
      const { error: itemsError } = await supabase.from("sale_items").insert(newItems);
      if (itemsError) throw itemsError;

      logAction("update", "sale", sale.id, `Edited invoice ${sale.invoice_no} - Rs ${total}`);
      toast.success("Invoice updated successfully");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      console.error("Edit bill error:", e);
      toast.error("Failed to update invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Edit Invoice {sale.invoice_no}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4">
            {/* Transaction Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk-in">Walk-in Customer</SelectItem>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="jazzcash">JazzCash</SelectItem>
                    <SelectItem value="easypaisa">EasyPaisa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Status</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Discount (Rs)</Label>
                <NumberInput value={discount} onValueChange={setDiscount} className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." className="h-9" />
            </div>

            <Separator />

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Line Items</Label>
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={addItem}>
                  <Plus className="h-3 w-3" /> Add Item
                </Button>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                  <span>Product</span><span>Qty</span><span>Price</span><span>Total</span><span />
                </div>
                {items.map((item, i) => (
                  <div key={item.id} className="grid grid-cols-[1fr_80px_100px_100px_32px] gap-2 items-center">
                    <Input
                      value={item.product_name}
                      onChange={e => updateItem(i, "product_name", e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Product name"
                    />
                    <NumberInput
                      value={item.quantity}
                      onValueChange={v => updateItem(i, "quantity", v)}
                      className="h-8 text-sm"
                    />
                    <NumberInput
                      value={item.unit_price}
                      onValueChange={v => updateItem(i, "unit_price", v)}
                      className="h-8 text-sm"
                    />
                    <div className="text-sm font-medium text-right pr-1">
                      Rs {Number(item.subtotal).toLocaleString()}
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(i)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="ml-auto w-56 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>Rs {subtotal.toLocaleString()}</span></div>
              {discount > 0 && <div className="flex justify-between text-destructive"><span>Discount</span><span>-Rs {discount.toLocaleString()}</span></div>}
              <Separator />
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span>Rs {total.toLocaleString()}</span></div>
            </div>

            <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

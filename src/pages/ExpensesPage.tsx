import { useState, useEffect } from "react";
import { Plus, Search, X, Receipt, Pencil, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Expense {
  id: string;
  category_id: string | null;
  amount: number;
  date: string;
  description: string | null;
  payment_method: string;
  reference_no: string | null;
}

interface Category { id: string; name: string; }

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ category_id: "", amount: 0, date: new Date().toISOString().split("T")[0], description: "", payment_method: "cash", reference_no: "" });

  const fetchData = async () => {
    setLoading(true);
    const [{ data: exps }, { data: cats }] = await Promise.all([
      supabase.from("expenses").select("*").order("date", { ascending: false }),
      supabase.from("expense_categories").select("*").order("name"),
    ]);
    setExpenses(exps || []);
    setCategories(cats || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = expenses.filter((e) =>
    e.description?.toLowerCase().includes(search.toLowerCase()) || e.reference_no?.toLowerCase().includes(search.toLowerCase())
  );

  const totalExpenses = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const handleSave = async () => {
    if (!form.amount) { toast.error("Amount is required"); return; }
    const payload = {
      category_id: form.category_id || null,
      amount: Number(form.amount),
      date: form.date,
      description: form.description || null,
      payment_method: form.payment_method,
      reference_no: form.reference_no || null,
    };

    if (editingId) {
      const { error } = await supabase.from("expenses").update(payload).eq("id", editingId);
      if (error) { toast.error("Failed to update"); return; }
      toast.success("Expense updated");
    } else {
      const { error } = await supabase.from("expenses").insert(payload);
      if (error) { toast.error("Failed to add expense"); return; }
      toast.success("Expense added");
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm({ category_id: "", amount: 0, date: new Date().toISOString().split("T")[0], description: "", payment_method: "cash", reference_no: "" });
    fetchData();
  };

  const startEdit = (e: Expense) => {
    setEditingId(e.id);
    setForm({ category_id: e.category_id || "", amount: e.amount, date: e.date, description: e.description || "", payment_method: e.payment_method, reference_no: e.reference_no || "" });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Expense deleted");
    fetchData();
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const { error } = await supabase.from("expense_categories").insert({ name: newCatName.trim() });
    if (error) { toast.error("Failed to add category"); return; }
    toast.success("Category added");
    setNewCatName("");
    setCatDialogOpen(false);
    fetchData();
  };

  const getCategoryName = (id: string | null) => categories.find((c) => c.id === id)?.name || "Uncategorized";

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">Total: Rs {totalExpenses.toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="gap-2"><Plus className="h-4 w-4" /> Category</Button></DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Add Expense Category</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Category name" />
                <Button onClick={addCategory} className="w-full">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); } }}>
            <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add Expense</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editingId ? "Edit Expense" : "Add Expense"}</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Amount *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Payment Method</Label>
                    <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
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
                <div className="space-y-1"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="space-y-1"><Label>Reference No</Label><Input value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} /></div>
                <Button onClick={handleSave} className="gap-2"><Save className="h-4 w-4" /> {editingId ? "Update" : "Save"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search expenses..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">No expenses recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-3 w-24 text-center font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <motion.tr key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">{e.date}</td>
                  <td className="px-4 py-3"><Badge variant="secondary">{getCategoryName(e.category_id)}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{e.description || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{e.payment_method}</td>
                  <td className="px-4 py-3 text-right font-medium text-destructive">Rs {Number(e.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(e.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/50 font-bold">
                <td colSpan={4} className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right text-destructive">Rs {totalExpenses.toLocaleString()}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

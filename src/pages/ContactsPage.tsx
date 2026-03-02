import { useState, useEffect } from "react";
import { Plus, Search, X, Users, Truck, Pencil, Trash2, Save } from "lucide-react";
import { NumberInput } from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Contact {
  id: string;
  type: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  opening_balance: number;
  current_balance: number;
  notes: string | null;
  created_at: string;
}

const emptyForm = { name: "", type: "customer", phone: "", email: "", address: "", city: "", opening_balance: 0, notes: "" };

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("customer");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("contacts").select("*").order("name");
    if (error) { toast.error("Failed to load contacts"); console.error(error); }
    else setContacts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchContacts(); }, []);

  const filtered = contacts.filter(
    (c) => c.type === tab && (c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.city?.toLowerCase().includes(search.toLowerCase()))
  );

  const totalBalance = filtered.reduce((s, c) => s + Number(c.current_balance), 0);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name.trim(),
      type: form.type,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      city: form.city || null,
      opening_balance: Number(form.opening_balance) || 0,
      current_balance: editingId ? undefined : Number(form.opening_balance) || 0,
      notes: form.notes || null,
    };

    if (editingId) {
      const { error } = await supabase.from("contacts").update(payload).eq("id", editingId);
      if (error) { toast.error("Failed to update"); return; }
      toast.success("Contact updated");
    } else {
      const { error } = await supabase.from("contacts").insert(payload);
      if (error) { toast.error("Failed to add contact"); return; }
      toast.success("Contact added");
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchContacts();
  };

  const startEdit = (c: Contact) => {
    setEditingId(c.id);
    setForm({ name: c.name, type: c.type, phone: c.phone || "", email: c.email || "", address: c.address || "", city: c.city || "", opening_balance: c.opening_balance, notes: c.notes || "" });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this contact?")) return;
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    toast.success("Contact deleted");
    fetchContacts();
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">Manage your customers and suppliers</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button className="gap-2" size="sm"><Plus className="h-4 w-4" /> Add Contact</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingId ? "Edit Contact" : "Add Contact"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div className="space-y-1"><Label>Opening Balance</Label><NumberInput value={form.opening_balance} onValueChange={(v) => setForm({ ...form, opening_balance: v })} /></div>
              </div>
              <div className="space-y-1"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-1"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button onClick={handleSave} className="gap-2"><Save className="h-4 w-4" /> {editingId ? "Update" : "Save"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="customer" className="gap-2"><Users className="h-4 w-4" /> Customers</TabsTrigger>
          <TabsTrigger value="supplier" className="gap-2"><Truck className="h-4 w-4" /> Suppliers</TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-4 mb-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name, phone, city..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
          </div>
          <Card className="px-4 py-2"><p className="text-xs text-muted-foreground">Total Balance</p><p className="text-lg font-bold">Rs {totalBalance.toLocaleString()}</p></Card>
        </div>

        <TabsContent value={tab}>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">{search ? "No contacts match your search." : `No ${tab}s yet. Add one to get started.`}</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">City</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
                    <th className="px-4 py-3 w-24 text-center font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.name}</div>
                        {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.phone || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.city || "—"}</td>
                      <td className={`px-4 py-3 text-right font-medium ${Number(c.current_balance) > 0 ? "text-destructive" : ""}`}>Rs {Number(c.current_balance).toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

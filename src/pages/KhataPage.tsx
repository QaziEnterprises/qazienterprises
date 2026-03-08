import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Users, Search, ArrowUpRight, ArrowDownRight, DollarSign, Phone } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  type: string;
  current_balance: number;
  opening_balance: number;
}

interface Transaction {
  id: string;
  date: string;
  total: number;
  invoice_no: string | null;
  payment_status: string | null;
  type: "sale" | "purchase";
}

export default function KhataPage() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "owed" | "owing">("all");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const fetchContacts = async () => {
    try {
      const { data } = await supabase.from("contacts").select("id, name, phone, type, current_balance, opening_balance").order("name");
      setContacts(data || []);
    } catch (e) {
      console.error("Khata fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  const fetchTransactions = async (contact: Contact) => {
    setSelectedContact(contact);
    setTxLoading(true);
    try {
      const [{ data: sales }, { data: purchases }] = await Promise.all([
        supabase.from("sale_transactions").select("id, date, total, invoice_no, payment_status").eq("customer_id", contact.id).order("date", { ascending: false }).limit(50),
        supabase.from("purchases").select("id, date, total, reference_no, payment_status").eq("supplier_id", contact.id).order("date", { ascending: false }).limit(50),
      ]);
      const all: Transaction[] = [
        ...(sales || []).map((s) => ({ ...s, type: "sale" as const, total: Number(s.total) })),
        ...(purchases || []).map((p) => ({ ...p, type: "purchase" as const, invoice_no: p.reference_no, total: Number(p.total) })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(all);
    } catch (e) {
      console.error(e);
    } finally {
      setTxLoading(false);
    }
  };

  const recordPayment = async () => {
    if (!selectedContact || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;
    try {
      const newBalance = (selectedContact.current_balance || 0) - amount;
      await supabase.from("contacts").update({ current_balance: newBalance }).eq("id", selectedContact.id);
      toast({ title: `Payment of Rs ${amount.toLocaleString()} recorded` });
      setPaymentAmount("");
      setPaymentNotes("");
      setSelectedContact({ ...selectedContact, current_balance: newBalance });
      fetchContacts();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const sendWhatsApp = (contact: Contact) => {
    if (!contact.phone) { toast({ title: "No phone number", variant: "destructive" }); return; }
    const msg = `Assalam-o-Alaikum ${contact.name}, your outstanding balance at Qazi Enterprises is Rs ${Math.abs(contact.current_balance || 0).toLocaleString()}. Please clear your dues at your earliest convenience. JazakAllah.`;
    window.open(`https://wa.me/${contact.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const filtered = contacts
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => {
      if (filter === "owed") return (c.current_balance || 0) > 0;
      if (filter === "owing") return (c.current_balance || 0) < 0;
      return true;
    })
    .sort((a, b) => Math.abs(b.current_balance || 0) - Math.abs(a.current_balance || 0));

  const totalOwed = contacts.reduce((s, c) => s + Math.max(0, c.current_balance || 0), 0);
  const totalOwing = contacts.reduce((s, c) => s + Math.abs(Math.min(0, c.current_balance || 0)), 0);

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Khata Book (Credit Ledger)</h1>
        <p className="text-muted-foreground">Track who owes you and whom you owe</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card className="cursor-pointer" onClick={() => setFilter("owed")}>
          <CardContent className="flex items-center gap-3 p-4">
            <ArrowDownRight className="h-5 w-5 text-green-600" />
            <div><div className="text-xl font-bold text-green-600">Rs {totalOwed.toLocaleString()}</div><p className="text-xs text-muted-foreground">Others owe you</p></div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setFilter("owing")}>
          <CardContent className="flex items-center gap-3 p-4">
            <ArrowUpRight className="h-5 w-5 text-destructive" />
            <div><div className="text-xl font-bold text-destructive">Rs {totalOwing.toLocaleString()}</div><p className="text-xs text-muted-foreground">You owe others</p></div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setFilter("all")}>
          <CardContent className="flex items-center gap-3 p-4">
            <DollarSign className="h-5 w-5 text-primary" />
            <div><div className="text-xl font-bold">Rs {(totalOwed - totalOwing).toLocaleString()}</div><p className="text-xs text-muted-foreground">Net Balance</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {(["all", "owed", "owing"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">{f === "owed" ? "They Owe" : f === "owing" ? "You Owe" : "All"}</Button>
        ))}
      </div>

      {/* Contact List */}
      <div className="space-y-2">
        {filtered.map((c) => (
          <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} layout>
            <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => fetchTransactions(c)}>
              <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.type} {c.phone ? `• ${c.phone}` : ""}</p>
              </div>
              <div className={`text-right font-bold tabular-nums ${(c.current_balance || 0) > 0 ? "text-green-600" : (c.current_balance || 0) < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                Rs {Math.abs(c.current_balance || 0).toLocaleString()}
                <p className="text-[10px] font-normal text-muted-foreground">{(c.current_balance || 0) > 0 ? "they owe" : (c.current_balance || 0) < 0 ? "you owe" : "settled"}</p>
              </div>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground">No contacts found</p>}
      </div>

      {/* Contact Detail Dialog */}
      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{selectedContact?.name}
              <Badge variant="outline" className="text-xs">{selectedContact?.type}</Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedContact && (
            <div className="space-y-4">
              {/* Balance */}
              <div className={`rounded-lg p-4 text-center ${(selectedContact.current_balance || 0) > 0 ? "bg-green-50 dark:bg-green-950/20" : (selectedContact.current_balance || 0) < 0 ? "bg-destructive/5" : "bg-muted"}`}>
                <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                <p className={`text-3xl font-bold ${(selectedContact.current_balance || 0) > 0 ? "text-green-600" : (selectedContact.current_balance || 0) < 0 ? "text-destructive" : ""}`}>
                  Rs {Math.abs(selectedContact.current_balance || 0).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(selectedContact.current_balance || 0) > 0 ? "They owe you" : (selectedContact.current_balance || 0) < 0 ? "You owe them" : "Settled"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {role === "admin" && selectedContact.phone && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => sendWhatsApp(selectedContact)}>
                    <Phone className="h-3.5 w-3.5 mr-1" /> WhatsApp Reminder
                  </Button>
                )}
              </div>

              {/* Record Payment */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Record Payment</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Input type="number" placeholder="Amount (Rs)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                  <Textarea placeholder="Notes (optional)" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows={2} />
                  <Button onClick={recordPayment} disabled={!paymentAmount} className="w-full" size="sm">Record Payment</Button>
                </CardContent>
              </Card>

              {/* Transaction History */}
              <div>
                <h4 className="font-medium text-sm mb-2">Recent Transactions</h4>
                {txLoading ? (
                  <div className="text-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto" /></div>
                ) : transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No transactions found</p>
                ) : (
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between text-sm rounded border p-2">
                        <div>
                          <span className="font-medium">{tx.invoice_no || "—"}</span>
                          <span className="text-xs text-muted-foreground ml-2">{new Date(tx.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={tx.type === "sale" ? "default" : "secondary"} className="text-[10px]">{tx.type}</Badge>
                          <span className="font-medium tabular-nums">Rs {tx.total.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

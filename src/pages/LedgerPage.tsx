import { useState, useEffect } from "react";
import { Search, X, Download, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { exportToExcel, printAsPDF } from "@/lib/exportUtils";

interface Contact {
  id: string; name: string; type: string; phone: string | null;
  current_balance: number; opening_balance: number;
}

interface LedgerEntry {
  date: string; type: string; ref: string; description: string;
  debit: number; credit: number; balance: number;
}

export default function LedgerPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase.from("contacts").select("*").order("name");
      setContacts(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.type.toLowerCase().includes(search.toLowerCase())
  );

  const viewLedger = async (contact: Contact) => {
    setSelectedContact(contact);
    setLedgerLoading(true);
    setDialogOpen(true);

    const entries: LedgerEntry[] = [];

    // Opening balance entry
    entries.push({
      date: "—", type: "Opening", ref: "—",
      description: "Opening Balance",
      debit: 0, credit: Number(contact.opening_balance) || 0, balance: Number(contact.opening_balance) || 0,
    });

    // Fetch sales for this customer
    let salesQuery = supabase.from("sale_transactions").select("*").eq("customer_id", contact.id).order("date");
    if (dateFrom) salesQuery = salesQuery.gte("date", dateFrom);
    if (dateTo) salesQuery = salesQuery.lte("date", dateTo);
    const { data: sales } = await salesQuery;

    for (const s of sales || []) {
      entries.push({
        date: s.date, type: "Sale", ref: s.invoice_no || "—",
        description: `Sale - ${s.payment_method} (${s.payment_status})`,
        debit: 0, credit: Number(s.total) || 0, balance: 0,
      });
    }

    // Fetch purchases where this contact is supplier
    let purchQuery = supabase.from("purchases").select("*").eq("supplier_id", contact.id).order("date");
    if (dateFrom) purchQuery = purchQuery.gte("date", dateFrom);
    if (dateTo) purchQuery = purchQuery.lte("date", dateTo);
    const { data: purchases } = await purchQuery;

    for (const p of purchases || []) {
      entries.push({
        date: p.date, type: "Purchase", ref: p.reference_no || "—",
        description: `Purchase - ${p.payment_method} (${p.payment_status})`,
        debit: Number(p.total) || 0, credit: 0, balance: 0,
      });
    }

    // Sort by date, then compute running balance
    entries.sort((a, b) => {
      if (a.date === "—") return -1;
      if (b.date === "—") return 1;
      return a.date.localeCompare(b.date);
    });

    let runningBalance = 0;
    for (const entry of entries) {
      if (entry.type === "Opening") {
        runningBalance = entry.credit;
        entry.balance = runningBalance;
      } else {
        runningBalance += entry.credit - entry.debit;
        entry.balance = runningBalance;
      }
    }

    setLedger(entries);
    setLedgerLoading(false);
  };

  const totalDebit = ledger.reduce((s, e) => s + e.debit, 0);
  const totalCredit = ledger.reduce((s, e) => s + e.credit, 0);

  const handleExportExcel = () => {
    if (!selectedContact) return;
    exportToExcel(ledger.map(e => ({
      Date: e.date, Type: e.type, Reference: e.ref, Description: e.description,
      Debit: e.debit, Credit: e.credit, Balance: e.balance,
    })), `Ledger_${selectedContact.name}`, "Ledger");
    toast.success("Exported to Excel");
  };

  const handleExportPDF = () => {
    if (!selectedContact) return;
    printAsPDF(`Account Statement - ${selectedContact.name}`,
      ["Date", "Type", "Ref", "Description", "Debit", "Credit", "Balance"],
      ledger.map(e => [e.date, e.type, e.ref, e.description, e.debit ? `Rs ${e.debit.toLocaleString()}` : "—", e.credit ? `Rs ${e.credit.toLocaleString()}` : "—", `Rs ${e.balance.toLocaleString()}`])
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> Customer Ledger
        </h1>
        <p className="text-sm text-muted-foreground">View account statements for all contacts</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
        </div>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" placeholder="From" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" placeholder="To" />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">No contacts found.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => viewLedger(c)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    {c.name}
                    <Badge variant={c.type === "customer" ? "default" : "secondary"}>{c.type}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{c.phone || "No phone"}</span>
                    <span className={`font-bold ${Number(c.current_balance) > 0 ? "text-destructive" : "text-green-600"}`}>
                      Rs {Number(c.current_balance).toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <span>Ledger — {selectedContact?.name}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={handleExportExcel}><Download className="h-4 w-4" /> Excel</Button>
                <Button size="sm" variant="outline" className="gap-2" onClick={handleExportPDF}><Download className="h-4 w-4" /> PDF</Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          {ledgerLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading ledger...</div>
          ) : (
            <>
              <div className="flex gap-4 mb-4">
                <Card className="flex-1 px-4 py-2">
                  <p className="text-xs text-muted-foreground">Total Debit</p>
                  <p className="text-lg font-bold">Rs {totalDebit.toLocaleString()}</p>
                </Card>
                <Card className="flex-1 px-4 py-2">
                  <p className="text-xs text-muted-foreground">Total Credit</p>
                  <p className="text-lg font-bold">Rs {totalCredit.toLocaleString()}</p>
                </Card>
                <Card className="flex-1 px-4 py-2">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className={`text-lg font-bold ${ledger.length > 0 && ledger[ledger.length - 1].balance > 0 ? "text-destructive" : "text-green-600"}`}>
                    Rs {ledger.length > 0 ? ledger[ledger.length - 1].balance.toLocaleString() : "0"}
                  </p>
                </Card>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ref</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Debit</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Credit</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((e, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2">{e.date}</td>
                        <td className="px-3 py-2"><Badge variant="outline">{e.type}</Badge></td>
                        <td className="px-3 py-2 text-muted-foreground">{e.ref}</td>
                        <td className="px-3 py-2">{e.description}</td>
                        <td className="px-3 py-2 text-right">{e.debit ? `Rs ${e.debit.toLocaleString()}` : "—"}</td>
                        <td className="px-3 py-2 text-right">{e.credit ? `Rs ${e.credit.toLocaleString()}` : "—"}</td>
                        <td className={`px-3 py-2 text-right font-medium ${e.balance > 0 ? "text-destructive" : ""}`}>Rs {e.balance.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

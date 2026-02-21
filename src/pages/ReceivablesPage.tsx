import { useState, useEffect, useRef } from "react";
import { Upload, Search, X, Users, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receivable, SaleEntry } from "@/types";
import { getReceivables, saveReceivables, getSales } from "@/lib/store";
import { parseReceivablesXlsx } from "@/lib/excel";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function ReceivablesPage() {
  const [items, setItems] = useState<Receivable[]>([]);
  const [sales, setSales] = useState<SaleEntry[]>([]);
  const [search, setSearch] = useState("");
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => {
    setItems(getReceivables());
    setSales(getSales());
  };
  useEffect(reload, []);

  const filtered = items.filter((i) =>
    i.partyName.toLowerCase().includes(search.toLowerCase())
  );

  const totalBalance = filtered.reduce((sum, i) => sum + i.balance, 0);
  const totalDebit = filtered.reduce((sum, i) => sum + i.debit, 0);
  const totalCredit = filtered.reduce((sum, i) => sum + i.credit, 0);

  const selectedReceivable = items.find((i) => i.partyName === selectedParty);
  const partySales = sales.filter(
    (s) => s.customerName.toLowerCase() === selectedParty?.toLowerCase()
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseReceivablesXlsx(file);
      saveReceivables(parsed);
      reload();
      toast.success(`Loaded ${parsed.length} receivable entries`);
    } catch {
      toast.error("Failed to parse Excel file");
    }
    e.target.value = "";
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receivables</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} parties · Total: Rs {totalBalance.toLocaleString()}
          </p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
          <Button onClick={() => fileRef.current?.click()} variant="outline" className="gap-2">
            <Upload className="h-4 w-4" /> Upload Excel
          </Button>
        </div>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search by party name..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            {search ? "No parties match your search." : "No data loaded. Upload a Receivables Excel file to get started."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-16">S.No</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Party Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ref No.</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Debit</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Credit</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className="border-b last:border-0 transition-colors hover:bg-muted/30 cursor-pointer"
                  onClick={() => setSelectedParty(item.partyName)}
                >
                  <td className="px-4 py-3 text-muted-foreground">{item.sno}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{item.date || "—"}</td>
                  <td className="px-4 py-3 font-medium text-primary hover:underline">{item.partyName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.refNo || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.description || "—"}</td>
                  <td className="px-4 py-3 text-right">{item.debit ? `Rs ${item.debit.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3 text-right">{item.credit ? `Rs ${item.credit.toLocaleString()}` : "—"}</td>
                  <td className={`px-4 py-3 text-right font-medium ${item.balance < 0 ? "text-success" : item.balance > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    Rs {item.balance.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </td>
                </motion.tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/50 font-bold">
                <td colSpan={5} className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">Rs {totalDebit.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">Rs {totalCredit.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">Rs {totalBalance.toLocaleString()}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Customer Detail Dialog */}
      <Dialog open={!!selectedParty} onOpenChange={(open) => !open && setSelectedParty(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedParty}</DialogTitle>
            <DialogDescription>Full customer details and purchase history</DialogDescription>
          </DialogHeader>

          {selectedReceivable && (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-xs text-muted-foreground">Debit</p>
                  <p className="text-lg font-bold">Rs {selectedReceivable.debit.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-xs text-muted-foreground">Credit</p>
                  <p className="text-lg font-bold">Rs {selectedReceivable.credit.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className={`text-lg font-bold ${selectedReceivable.balance < 0 ? "text-success" : selectedReceivable.balance > 0 ? "text-destructive" : ""}`}>
                    Rs {selectedReceivable.balance.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Receivable Info */}
              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-semibold text-sm">Receivable Info</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Date:</span> {selectedReceivable.date || "N/A"}</div>
                  <div><span className="text-muted-foreground">Ref No:</span> {selectedReceivable.refNo || "N/A"}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Description:</span> {selectedReceivable.description || "N/A"}</div>
                </div>
              </div>

              {/* Purchase History from Sales */}
              <div>
                <h3 className="font-semibold text-sm mb-3">Purchase History ({partySales.length} entries)</h3>
                {partySales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales history found for this customer. Upload a Sales Excel to see purchase history.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Bill No.</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Cash</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">J.C</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">E.P</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">B.T</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Not Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partySales.map((s) => (
                          <tr key={s.id} className="border-b last:border-0">
                            <td className="px-3 py-2 whitespace-nowrap">{s.date}</td>
                            <td className="px-3 py-2">{s.billNo}</td>
                            <td className="px-3 py-2 text-right">{s.cash ? `Rs ${s.cash.toLocaleString()}` : "—"}</td>
                            <td className="px-3 py-2 text-right">{s.jc ? `Rs ${s.jc.toLocaleString()}` : "—"}</td>
                            <td className="px-3 py-2 text-right">{s.ep ? `Rs ${s.ep.toLocaleString()}` : "—"}</td>
                            <td className="px-3 py-2 text-right">{s.bt ? `Rs ${s.bt.toLocaleString()}` : "—"}</td>
                            <td className="px-3 py-2 text-right">{s.notPaid ? `Rs ${s.notPaid.toLocaleString()}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

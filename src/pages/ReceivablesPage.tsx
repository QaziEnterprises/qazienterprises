import { useState, useEffect, useRef } from "react";
import { Upload, Search, X, Users, ChevronRight, Pencil, Trash2, Save } from "lucide-react";
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
import { Label } from "@/components/ui/label";

export default function ReceivablesPage() {
  const [items, setItems] = useState<Receivable[]>([]);
  const [sales, setSales] = useState<SaleEntry[]>([]);
  const [search, setSearch] = useState("");
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Receivable>>({});
  const [dialogEditing, setDialogEditing] = useState(false);
  const [dialogForm, setDialogForm] = useState<Partial<Receivable>>({});
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

  const startInlineEdit = (item: Receivable, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const saveInlineEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId || !editForm) return;
    const updated = items.map((i) =>
      i.id === editingId ? { ...i, ...editForm, debit: Number(editForm.debit) || 0, credit: Number(editForm.credit) || 0, balance: Number(editForm.balance) || 0 } : i
    );
    saveReceivables(updated);
    setItems(updated);
    setEditingId(null);
    toast.success("Entry updated");
  };

  const cancelInlineEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const deleteEntry = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = items.filter((i) => i.id !== id);
    saveReceivables(updated);
    setItems(updated);
    toast.success("Entry deleted");
  };

  const startDialogEdit = () => {
    if (!selectedReceivable) return;
    setDialogEditing(true);
    setDialogForm({ ...selectedReceivable });
  };

  const saveDialogEdit = () => {
    if (!dialogForm.id) return;
    const updated = items.map((i) =>
      i.id === dialogForm.id ? { ...i, ...dialogForm, debit: Number(dialogForm.debit) || 0, credit: Number(dialogForm.credit) || 0, balance: Number(dialogForm.balance) || 0 } : i
    );
    saveReceivables(updated);
    setItems(updated);
    setDialogEditing(false);
    setSelectedParty(dialogForm.partyName || selectedParty);
    toast.success("Entry updated");
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
                <th className="px-4 py-3 w-28 text-center font-medium text-muted-foreground">Actions</th>
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
                  onClick={() => editingId !== item.id && setSelectedParty(item.partyName)}
                >
                  <td className="px-4 py-3 text-muted-foreground">{item.sno}</td>
                  {editingId === item.id ? (
                    <>
                      <td className="px-2 py-1"><Input value={editForm.date || ""} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="h-8 text-xs" onClick={(e) => e.stopPropagation()} /></td>
                      <td className="px-2 py-1"><Input value={editForm.partyName || ""} onChange={(e) => setEditForm({ ...editForm, partyName: e.target.value })} className="h-8 text-xs" onClick={(e) => e.stopPropagation()} /></td>
                      <td className="px-2 py-1"><Input value={editForm.refNo || ""} onChange={(e) => setEditForm({ ...editForm, refNo: e.target.value })} className="h-8 text-xs" onClick={(e) => e.stopPropagation()} /></td>
                      <td className="px-2 py-1"><Input value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="h-8 text-xs" onClick={(e) => e.stopPropagation()} /></td>
                      <td className="px-2 py-1"><Input type="number" value={editForm.debit || 0} onChange={(e) => setEditForm({ ...editForm, debit: Number(e.target.value) })} className="h-8 text-xs text-right" onClick={(e) => e.stopPropagation()} /></td>
                      <td className="px-2 py-1"><Input type="number" value={editForm.credit || 0} onChange={(e) => setEditForm({ ...editForm, credit: Number(e.target.value) })} className="h-8 text-xs text-right" onClick={(e) => e.stopPropagation()} /></td>
                      <td className="px-2 py-1"><Input type="number" value={editForm.balance || 0} onChange={(e) => setEditForm({ ...editForm, balance: Number(e.target.value) })} className="h-8 text-xs text-right" onClick={(e) => e.stopPropagation()} /></td>
                      <td className="px-2 py-1 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveInlineEdit}><Save className="h-3.5 w-3.5 text-success" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelInlineEdit}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{item.date || "—"}</td>
                      <td className="px-4 py-3 font-medium text-primary hover:underline">{item.partyName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.refNo || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{item.description || "—"}</td>
                      <td className="px-4 py-3 text-right">{item.debit ? `Rs ${item.debit.toLocaleString()}` : "—"}</td>
                      <td className="px-4 py-3 text-right">{item.credit ? `Rs ${item.credit.toLocaleString()}` : "—"}</td>
                      <td className={`px-4 py-3 text-right font-medium ${item.balance < 0 ? "text-success" : item.balance > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        Rs {item.balance.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => startInlineEdit(item, e)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => deleteEntry(item.id, e)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </td>
                    </>
                  )}
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
      <Dialog open={!!selectedParty} onOpenChange={(open) => { if (!open) { setSelectedParty(null); setDialogEditing(false); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedParty}</span>
              {!dialogEditing && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={startDialogEdit}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
            </DialogTitle>
            <DialogDescription>Full customer details and purchase history</DialogDescription>
          </DialogHeader>

          {selectedReceivable && !dialogEditing && (
            <div className="space-y-6">
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

              <div className="rounded-lg border p-4 space-y-2">
                <h3 className="font-semibold text-sm">Receivable Info</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Date:</span> {selectedReceivable.date || "N/A"}</div>
                  <div><span className="text-muted-foreground">Ref No:</span> {selectedReceivable.refNo || "N/A"}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Description:</span> {selectedReceivable.description || "N/A"}</div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-3">Purchase History ({partySales.length} entries)</h3>
                {partySales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales history found. Upload a Sales Excel to see purchase history.</p>
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

          {/* Edit Form in Dialog */}
          {dialogEditing && dialogForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Party Name</Label>
                  <Input value={dialogForm.partyName || ""} onChange={(e) => setDialogForm({ ...dialogForm, partyName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date</Label>
                  <Input value={dialogForm.date || ""} onChange={(e) => setDialogForm({ ...dialogForm, date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ref No.</Label>
                  <Input value={dialogForm.refNo || ""} onChange={(e) => setDialogForm({ ...dialogForm, refNo: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description</Label>
                  <Input value={dialogForm.description || ""} onChange={(e) => setDialogForm({ ...dialogForm, description: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Debit</Label>
                  <Input type="number" value={dialogForm.debit || 0} onChange={(e) => setDialogForm({ ...dialogForm, debit: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Credit</Label>
                  <Input type="number" value={dialogForm.credit || 0} onChange={(e) => setDialogForm({ ...dialogForm, credit: Number(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Balance</Label>
                  <Input type="number" value={dialogForm.balance || 0} onChange={(e) => setDialogForm({ ...dialogForm, balance: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogEditing(false)}>Cancel</Button>
                <Button onClick={saveDialogEdit} className="gap-1.5"><Save className="h-4 w-4" /> Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

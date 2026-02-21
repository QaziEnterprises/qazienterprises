import { useState, useEffect, useRef } from "react";
import { Upload, Search, X, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaleEntry } from "@/types";
import { getSales, saveSales } from "@/lib/store";
import { parseSalesXlsx } from "@/lib/excel";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function SalesPage() {
  const [items, setItems] = useState<SaleEntry[]>([]);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => setItems(getSales());
  useEffect(reload, []);

  const filtered = items.filter((i) =>
    i.customerName.toLowerCase().includes(search.toLowerCase()) ||
    i.billNo.toLowerCase().includes(search.toLowerCase())
  );

  const totals = filtered.reduce(
    (acc, s) => ({
      cash: acc.cash + s.cash,
      jc: acc.jc + s.jc,
      ep: acc.ep + s.ep,
      bt: acc.bt + s.bt,
      notPaid: acc.notPaid + s.notPaid,
    }),
    { cash: 0, jc: 0, ep: 0, bt: 0, notPaid: 0 }
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseSalesXlsx(file);
      saveSales(parsed);
      reload();
      toast.success(`Loaded ${parsed.length} sales entries`);
    } catch {
      toast.error("Failed to parse Excel file");
    }
    e.target.value = "";
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Summary</h1>
          <p className="text-sm text-muted-foreground">{items.length} entries</p>
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
        <Input placeholder="Search by customer or bill no..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            {search ? "No entries match your search." : "No data loaded. Upload a Sales Summary Excel file."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bill No.</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Cash</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">J.C</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">E.P</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">B.T</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Not Paid</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => (
                <motion.tr
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className="border-b last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{entry.date}</td>
                  <td className="px-4 py-3 font-medium">{entry.customerName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.billNo}</td>
                  <td className="px-4 py-3 text-right">{entry.cash ? `Rs ${entry.cash.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3 text-right">{entry.jc ? `Rs ${entry.jc.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3 text-right">{entry.ep ? `Rs ${entry.ep.toLocaleString()}` : "—"}</td>
                  <td className="px-4 py-3 text-right">{entry.bt ? `Rs ${entry.bt.toLocaleString()}` : "—"}</td>
                  <td className={`px-4 py-3 text-right font-medium ${entry.notPaid > 0 ? "text-destructive" : ""}`}>
                    {entry.notPaid ? `Rs ${entry.notPaid.toLocaleString()}` : "—"}
                  </td>
                </motion.tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/50 font-bold">
                <td colSpan={3} className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">Rs {totals.cash.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">Rs {totals.jc.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">Rs {totals.ep.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">Rs {totals.bt.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-destructive">Rs {totals.notPaid.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

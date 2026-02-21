import { useState, useEffect, useRef } from "react";
import { Upload, Search, X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receivable } from "@/types";
import { getReceivables, saveReceivables } from "@/lib/store";
import { parseReceivablesXlsx } from "@/lib/excel";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function ReceivablesPage() {
  const [items, setItems] = useState<Receivable[]>([]);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => setItems(getReceivables());
  useEffect(reload, []);

  const filtered = items.filter((i) =>
    i.partyName.toLowerCase().includes(search.toLowerCase())
  );

  const totalBalance = filtered.reduce((sum, i) => sum + i.balance, 0);

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
          <p className="text-sm text-muted-foreground">{items.length} parties · Total: Rs {totalBalance.toLocaleString()}</p>
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
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground w-16">S.No</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Party Name</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.01 }}
                  className="border-b last:border-0 transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 text-muted-foreground">{item.sno}</td>
                  <td className="px-4 py-3 font-medium">{item.partyName}</td>
                  <td className={`px-4 py-3 text-right font-medium ${item.balance < 0 ? "text-success" : item.balance > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    Rs {item.balance.toLocaleString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/50 font-bold">
                <td colSpan={2} className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right">Rs {totalBalance.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

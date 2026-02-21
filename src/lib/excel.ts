import * as XLSX from "xlsx";
import { Receivable, SaleEntry } from "@/types";

export function parseReceivablesXlsx(file: File): Promise<Receivable[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

        const receivables: Receivable[] = [];
        for (let i = 0; i < json.length; i++) {
          const row = json[i];
          if (row && row.length >= 3 && typeof row[0] === "number") {
            const balance = typeof row[2] === "number" ? row[2] : parseFloat(String(row[2]).replace(/,/g, "")) || 0;
            const debit = row[3] != null ? (typeof row[3] === "number" ? row[3] : parseFloat(String(row[3]).replace(/,/g, "")) || 0) : 0;
            const credit = row[4] != null ? (typeof row[4] === "number" ? row[4] : parseFloat(String(row[4]).replace(/,/g, "")) || 0) : 0;
            receivables.push({
              id: crypto.randomUUID(),
              sno: row[0],
              partyName: String(row[1] || "").trim(),
              date: row[5] ? String(row[5]) : "",
              refNo: row[6] ? String(row[6]) : "",
              description: row[7] ? String(row[7]) : "",
              debit,
              credit,
              balance,
            });
          }
        }
        resolve(receivables);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function parseSalesXlsx(file: File): Promise<SaleEntry[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

        const sales: SaleEntry[] = [];
        for (let i = 1; i < json.length; i++) {
          const row = json[i];
          if (row && row[1] && String(row[1]).trim() && String(row[1]).toLowerCase() !== "total" && String(row[1]).toLowerCase() !== "total ") {
            const dateVal = row[0];
            let dateStr = "";
            if (typeof dateVal === "number") {
              const d = XLSX.SSF.parse_date_code(dateVal);
              dateStr = `${d.d}/${d.m}/${d.y}`;
            } else if (dateVal) {
              dateStr = String(dateVal);
            }
            if (!dateStr || dateStr.toLowerCase().includes("received") || dateStr.toLowerCase().includes("income") || dateStr.toLowerCase().includes("grand") || dateStr.toLowerCase().includes("expense")) continue;

            sales.push({
              id: crypto.randomUUID(),
              date: dateStr,
              customerName: String(row[1]).trim(),
              billNo: String(row[2] || ""),
              cash: Number(row[3]) || 0,
              jc: Number(row[4]) || 0,
              ep: Number(row[5]) || 0,
              bt: Number(row[6]) || 0,
              notPaid: Number(row[7]) || 0,
            });
          }
        }
        resolve(sales);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

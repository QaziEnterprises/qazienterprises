import { InventoryItem, Receivable, SaleEntry } from "@/types";
import { parseReceivablesFromBuffer, parseSalesFromBuffer } from "@/lib/excel";

const KEYS = {
  inventory: "shop_inventory",
  receivables: "shop_receivables",
  sales: "shop_sales",
  initialized: "shop_data_initialized",
};

function get<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function set<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Auto-load bundled Excel files on first visit
export async function initializeDefaultData() {
  if (localStorage.getItem(KEYS.initialized)) return;
  
  try {
    const [recvRes, salesRes] = await Promise.all([
      fetch("/data/RECEIVABLES.xlsx"),
      fetch("/data/Summary.xlsx"),
    ]);

    if (recvRes.ok) {
      const buf = new Uint8Array(await recvRes.arrayBuffer());
      const receivables = parseReceivablesFromBuffer(buf);
      if (receivables.length > 0) saveReceivables(receivables);
    }

    if (salesRes.ok) {
      const buf = new Uint8Array(await salesRes.arrayBuffer());
      const sales = parseSalesFromBuffer(buf);
      if (sales.length > 0) saveSales(sales);
    }

    localStorage.setItem(KEYS.initialized, "true");
  } catch (err) {
    console.error("Failed to load default data:", err);
  }
}

// Inventory
export function getInventory(): InventoryItem[] {
  return get<InventoryItem>(KEYS.inventory);
}

export function saveInventory(items: InventoryItem[]) {
  set(KEYS.inventory, items);
}

export function addInventoryItem(item: Omit<InventoryItem, "id" | "createdAt">): InventoryItem {
  const items = getInventory();
  const newItem: InventoryItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  items.push(newItem);
  saveInventory(items);
  return newItem;
}

export function updateInventoryItem(id: string, updates: Partial<InventoryItem>) {
  const items = getInventory().map((item) =>
    item.id === id ? { ...item, ...updates } : item
  );
  saveInventory(items);
}

export function deleteInventoryItem(id: string) {
  saveInventory(getInventory().filter((item) => item.id !== id));
}

// Receivables
export function getReceivables(): Receivable[] {
  return get<Receivable>(KEYS.receivables);
}

export function saveReceivables(items: Receivable[]) {
  set(KEYS.receivables, items);
}

// Sales
export function getSales(): SaleEntry[] {
  return get<SaleEntry>(KEYS.sales);
}

export function saveSales(items: SaleEntry[]) {
  set(KEYS.sales, items);
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  createdAt: string;
}

export interface Receivable {
  id: string;
  sno: number;
  partyName: string;
  balance: number;
}

export interface SaleEntry {
  id: string;
  date: string;
  customerName: string;
  billNo: string;
  cash: number;
  jc: number;
  ep: number;
  bt: number;
  notPaid: number;
}

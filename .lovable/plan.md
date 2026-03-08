

## Implementation Plan: 6 Daily Life Features

### Analysis of What Already Exists
- **Daily Cash Summary** -- CashRegisterPage already tracks opening/closing/cash-in/cash-out. Missing: a printable end-of-day summary report.
- **Low Stock Alerts** -- Dashboard already shows low stock products. Missing: a dedicated notification bell/panel and reorder suggestions.
- **Daily Expense Tracker** -- ExpensesPage already exists with categories. Missing: recurring expenses and daily budget tracking.
- **Daily Profit Snapshot** -- Dashboard already shows today's profit. ProfitCalculatorPage exists. Missing: a prominent real-time widget.
- **Price List Generator** -- Does not exist. New page needed.
- **Barcode Scanner** -- Does not exist. New capability for POS.

### Plan

#### 1. Enhanced Daily Cash Summary (End-of-Day Report)
- Add a "Print End-of-Day Report" button to CashRegisterPage
- The report includes: opening balance, all cash sales, expenses, purchases (cash), closing balance, discrepancy, payment method breakdown (JazzCash/EasyPaisa/Bank/Cash)
- Uses the existing `printAsPDF` utility or a custom print layout

#### 2. Low Stock Alerts Panel
- Add a notification bell icon in the AppLayout header bar
- Clicking opens a dropdown/sheet showing all products below their alert threshold with quantity info
- Add a "Reorder Suggestion" badge showing how many units to order (threshold - current qty)
- Link each item to the Products page for quick action

#### 3. Customer Payment Reminders
- Add a "Send Reminder" button on KhataPage for contacts with overdue balances
- Opens WhatsApp with a pre-filled message: "Dear [Name], your outstanding balance is Rs [amount]. Please arrange payment at your earliest convenience. - Qazi Enterprises"
- Uses `window.open(https://wa.me/[phone]?text=...)` -- no backend needed
- Only show for contacts with phone numbers and positive balances

#### 4. Enhanced Daily Expense Tracker
- Add date filter tabs (Today / This Week / This Month) to ExpensesPage header
- Add a category-wise spending summary card at the top showing breakdown by category with small bar chart
- Add a "Quick Add" floating button for fast expense entry on mobile

#### 5. Price List Generator (New Page)
- New page `/price-list` with nav entry
- Fetches all products grouped by category
- Displays a clean, printable price list with: Product Name, SKU, Unit, Selling Price
- "Print Price List" button using window.print() with print-optimized CSS
- "Share as PDF" button
- Option to filter by category
- Shows last updated date

#### 6. Daily Profit Snapshot (Dashboard Enhancement)
- Enhance the existing Today's Summary section on Dashboard with a more prominent profit card
- Add a color-coded profit indicator (green for profit, red for loss)
- Add a mini sparkline showing last 7 days profit trend
- Show profit margin percentage

#### 7. Barcode Scanner for POS
- Add a "Scan" button to POS page
- Uses the browser's native `navigator.mediaDevices.getUserMedia()` API with a lightweight barcode detection approach
- Uses the `BarcodeDetector` Web API (available in Chrome/Edge) to read barcodes from camera
- Falls back to manual SKU entry if BarcodeDetector is unavailable
- When a barcode/SKU is detected, auto-search products by SKU and add to cart
- Camera opens in a modal overlay

### Files to Create
- `src/pages/PriceListPage.tsx` -- Price list generator page
- `src/components/LowStockAlerts.tsx` -- Notification bell + dropdown
- `src/components/BarcodeScanner.tsx` -- Camera barcode scanning component

### Files to Modify
- `src/App.tsx` -- Add /price-list route
- `src/components/AppLayout.tsx` -- Add Price List nav item + low stock bell in header
- `src/pages/CashRegisterPage.tsx` -- Add printable end-of-day report
- `src/pages/ExpensesPage.tsx` -- Add date filters + category summary
- `src/pages/KhataPage.tsx` -- Add WhatsApp reminder button
- `src/pages/DashboardPage.tsx` -- Enhanced profit snapshot with sparkline
- `src/pages/POSPage.tsx` -- Add barcode scan button + scanner integration

### No Database Changes Required
All features use existing tables (products, expenses, contacts, sale_transactions, purchases, cash_register).


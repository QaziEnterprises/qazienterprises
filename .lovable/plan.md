

## Plan: Customer Ledger, WhatsApp Sharing, and Audit Trail (Admin-Only)

### 1. Customer Ledger / Account Statement Page
**New page: `src/pages/LedgerPage.tsx`** accessible from sidebar (admin only).

- Shows a list of all contacts (customers/suppliers) with their current balance
- Click a contact to see full transaction history: all sales, purchases, payments, and receivable entries aggregated into a chronological ledger with running balance
- Date range filter to narrow the view
- Export options: Excel and PDF statement generation (using existing `exportUtils`)
- Data sources: `sale_transactions` (by `customer_id`), `purchases` (by `supplier_id`), `contacts` (balances), and localStorage receivables

No database migration needed -- reads from existing tables.

### 2. WhatsApp Invoice Sharing
**Modify: `src/pages/POSPage.tsx` and `src/pages/BillsPage.tsx`**

- Add a WhatsApp share button next to the Print button on invoice dialogs
- Constructs a formatted text message with invoice details (invoice no, date, items, total, payment method)
- Opens `https://wa.me/?text=...` (or `https://wa.me/{phone}?text=...` if customer phone is available from contacts)
- Admin-only: button only renders when `role === 'admin'`

No database migration needed.

### 3. User Activity Audit Trail
**New table + page**

**Database migration:**
```sql
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  action text NOT NULL,        -- 'create', 'update', 'delete'
  entity_type text NOT NULL,   -- 'sale', 'purchase', 'expense', 'contact', 'product'
  entity_id text,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can insert (log their actions)
CREATE POLICY "Authenticated can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);
```

**New utility: `src/lib/auditLog.ts`** -- a simple helper function:
```typescript
export async function logAction(action, entityType, entityId, description) { ... }
```
Called from key mutation points in POS (sale complete), Purchases (add/delete), Expenses (add/delete), Contacts (add/edit/delete), Products (add/edit/delete).

**New page: `src/pages/AuditPage.tsx`** (admin only, added to sidebar with `adminOnly: true`):
- Chronological table of all actions with user email, action type, entity, description, timestamp
- Search/filter by user, action type, entity type, and date range
- No edit/delete -- read-only log

### 4. Routing & Sidebar Updates
**Modify: `src/App.tsx` and `src/components/AppLayout.tsx`**

- Add `/ledger` route (admin only) with BookOpen icon
- Add `/audit` route (admin only) with ClipboardList icon
- Both use `<ProtectedRoute adminOnly>`

### Files to create/modify:
- **Create:** `src/pages/LedgerPage.tsx`, `src/pages/AuditPage.tsx`, `src/lib/auditLog.ts`
- **Modify:** `src/App.tsx`, `src/components/AppLayout.tsx`, `src/pages/POSPage.tsx`, `src/pages/BillsPage.tsx`, `src/pages/PurchasesPage.tsx`, `src/pages/ExpensesPage.tsx`, `src/pages/ContactsPage.tsx`, `src/pages/ProductsPage.tsx`
- **Migration:** Create `audit_logs` table with admin-only SELECT RLS


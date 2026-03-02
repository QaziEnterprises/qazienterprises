

# Fix and Improve Qazi Enterprises - Comprehensive Plan

## Problem Analysis

The app was reverted to a working version after a broken update caused a blank white screen. The current version works but has several issues that need fixing, plus missing professional features. Here's what needs to be done:

---

## 1. Fix Missing Database Triggers (Critical)

The database functions exist (`generate_invoice_no`, `update_updated_at`, `handle_new_user`) but **no triggers are attached** to any tables. This means:
- Invoice numbers are NOT being auto-generated (POS sales get `null` invoice numbers)
- `updated_at` columns never update
- New user signups don't create profile records automatically

**Fix:** Create a migration to attach all three triggers to their respective tables.

---

## 2. Fix the "forwardRef" Console Warning

The `AuthProvider` component is getting a ref warning because of how React Router passes refs. This needs a minor fix in `App.tsx` to prevent the warning.

---

## 3. Add Error Boundaries and Try/Catch Protection

Wrap all async operations in try/catch blocks across every page to prevent unhandled promise rejections from causing blank screens. Add a global error boundary component and an unhandled rejection handler in `App.tsx`.

---

## 4. Add Customer Type Selection to POS

When creating a bill in POS, add options for customer type:
- Walk-in
- Regular
- Wholesale
- Credit

The `sale_transactions` table already has a `customer_type` column, so this just needs UI work in `POSPage.tsx`.

---

## 5. Improve the NumberInput Component

The existing `NumberInput` component handles the leading zero issue, but ensure it's used consistently across ALL numeric fields in the app (Contacts page opening balance field still uses raw `<Input type="number">`).

---

## 6. Add Professional Features

### a. Dashboard Enhancement
- Pull real-time data from the database (sales, purchases, expenses) instead of only localStorage data
- Show today's sales, purchases, expenses totals as summary cards
- Add low stock alerts from the products database

### b. Bills Page Enhancement
- Add status filter tabs (All, Paid, Due, Partial)
- Add summary header showing total billed, total paid, total due amounts
- Add date range filter

### c. POS Page Fixes
- Add try/catch around checkout flow
- Add customer type dropdown
- Show notes field
- Ensure invoice number displays correctly after trigger fix

### d. Login Page Branding
- Change "ShopManager" to "Qazi Enterprises" to match the rest of the app

---

## 7. Files to be Modified

| File | Changes |
|------|---------|
| `supabase/migrations/new_migration.sql` | Create triggers for invoice_no, updated_at, and handle_new_user |
| `src/App.tsx` | Add error boundary, unhandled rejection handler |
| `src/pages/POSPage.tsx` | Add customer type, try/catch, notes field |
| `src/pages/DashboardPage.tsx` | Add database-driven stats alongside localStorage stats |
| `src/pages/BillsPage.tsx` | Add status filters, date range, summary cards |
| `src/pages/ContactsPage.tsx` | Use NumberInput for opening_balance field |
| `src/pages/LoginPage.tsx` | Update branding to "Qazi Enterprises" |
| `src/components/ErrorBoundary.tsx` | New global error boundary component |

---

## Technical Details

### Database Migration SQL
```text
-- Attach invoice number trigger to sale_transactions
CREATE TRIGGER set_invoice_no
  BEFORE INSERT ON public.sale_transactions
  FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_no();

-- Attach updated_at triggers  
CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at_contacts
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Attach new user profile creation trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

Note: The `auth.users` trigger cannot be created via migration (reserved schema). The `handle_new_user` trigger needs to be verified separately. The products and contacts triggers will be created.

### Error Boundary Pattern
A React class component that catches render errors and shows a recovery UI instead of a blank screen.

### Global Rejection Handler
Added to `App.tsx` to catch any missed async errors and show a toast notification instead of crashing.


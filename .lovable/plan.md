
Issue identified (why you are seeing white background + loading for hours):
1) The app is getting stuck in its startup loading gate (`loading || !ready` in `AppRoutes`).
2) `ready` already has a timeout fallback, but auth `loading` can stay true forever because `useAuth` currently has no `try/catch/finally` safety around async startup (`getSession`, role fetch, auth callback).
3) Multiple pages (POS, Products, Purchases, Expenses, Bills, Reports, Contacts) also set `loading=true` and await queries without `finally`; if any query rejects, those pages can stay on “Loading...” permanently.
4) Session/network evidence shows token refresh succeeds, so this is most likely frontend async state deadlock rather than backend outage.

Implementation plan (targeted and professional hardening):
1) Harden auth bootstrap (`src/hooks/useAuth.tsx`) so loading can never hang
   - Add a single `initializeAuth()` with `try/catch/finally`.
   - Wrap `supabase.auth.getSession()` in timeout guard (e.g., `Promise.race` with 6–8s timeout).
   - Make role fetch non-blocking-safe with its own timeout and fallback to `"user"`.
   - Ensure every path ends with `setLoading(false)`.
   - Add concise console diagnostics for startup phase (`auth:init`, `auth:role`, `auth:done`).

2) Remove deadlock patterns in auth state listener
   - Avoid awaiting long async work directly inside `onAuthStateChange` without protection.
   - Handle errors inside listener callback explicitly.
   - Keep UI responsive even if role query fails (default role, then continue).

3) Standardize page data loaders to never freeze (`try/catch/finally`)
   - Files: `POSPage`, `ProductsPage`, `PurchasesPage`, `ExpensesPage`, `BillsPage`, `ReportsPage`, `ContactsPage`, `LoginPage` (submit path too).
   - For each fetch:
     - `setLoading(true)` before request
     - `try` load data
     - `catch` show toast + log error
     - `finally` always `setLoading(false)`
   - This fixes tabs getting stuck and improves reliability under slow/failed network.

4) Improve user recovery UX for startup failures
   - In `App.tsx` loading screen, after timeout threshold show:
     - “Retry initialization” button
     - Optional “Sign out and return to login” recovery action
   - Prevent silent infinite spinner even in rare corrupted-session states.

5) Validate professionally end-to-end after changes
   - Fresh new tab on preview root route.
   - Logged-in startup and logged-out startup.
   - Admin routes: POS, Products, Purchases, Expenses, Bills, Reports.
   - Simulate query failure and confirm pages recover (toast + no stuck spinner).
   - Confirm no regression in role-based routing and invoice/print flows.

Technical details:
- No database migration is required for this specific loading freeze fix.
- Main code risk area is async control flow in frontend, not schema.
- We will keep existing architecture (AuthProvider + route guards) and harden execution paths rather than redesign routing.
- This is the correct approach for your symptom because replay shows loader mounts and never exits, and current code has missing `finally` paths in critical async chains.

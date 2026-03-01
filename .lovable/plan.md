

## Fix: Slow App Loading

### Problem
The app takes too long to load because of three compounding issues:
1. All 12 page components are **eagerly imported** -- the browser downloads and parses all page code before rendering anything
2. **Excel file initialization** blocks rendering even when data already exists (the fetch still initiates before checking localStorage)
3. Auth session check + role fetch are **sequential network calls** that must complete before any UI shows

### Solution

#### 1. Lazy-load all page components
Convert all 12 page imports in `App.tsx` to use `React.lazy()` so only the login page (or current route) is downloaded initially.

```text
Before: import DashboardPage from "@/pages/DashboardPage"
After:  const DashboardPage = lazy(() => import("@/pages/DashboardPage"))
```

Wrap routes in `<Suspense fallback={<FullScreenLoader />}>` so there's a spinner while pages load on demand.

#### 2. Fix initializeDefaultData to skip immediately
Move the `localStorage.getItem(KEYS.initialized)` check to the **very top** before any async work. Currently it returns early but the function is still `await`ed. This is already correct but the `ready` state gate is unnecessary -- remove it entirely since initialization is non-critical.

#### 3. Remove the `ready` state gate
The `ready` state and 5-second timeout add unnecessary delay. The Excel init only matters on first visit and shouldn't block the entire app. Remove the `ready` state from `AppRoutes` and let `initializeDefaultData()` run in the background (fire-and-forget).

#### 4. Reduce safety timeout from 5s to 2s (fallback)
If we keep any timeout-based safety net, reduce it to 2 seconds max.

### Files to Change

**src/App.tsx:**
- Replace all 12 eager `import` statements with `React.lazy()` calls
- Add `Suspense` wrapper around routes with `FullScreenLoader` fallback
- Remove `ready` state and the `initializeDefaultData` useEffect gate -- call it fire-and-forget in the effect (no awaiting)
- Remove the 5-second safety timeout

**src/lib/store.ts:**
- No changes needed (already checks localStorage flag first)

### Technical Details

```text
App.tsx changes:
- import { lazy, Suspense } from "react"
- const DashboardPage = lazy(() => import("@/pages/DashboardPage"))
- const InventoryPage = lazy(() => import("@/pages/InventoryPage"))
- ... (all 12 pages)
- Remove: const [ready, setReady] = useState(false)
- Remove: the timeout and initializeDefaultData await logic  
- Add: useEffect(() => { initializeDefaultData(); }, [])  (fire-and-forget)
- Wrap <Routes> in <Suspense fallback={<FullScreenLoader />}>
- Loading condition becomes just: if (loading) return <FullScreenLoader />
```

### Expected Result
- Initial load only downloads login page code (or current route)
- No blocking on Excel file parsing
- Auth check is the only gate, typically completes in under 1 second
- Other pages load on-demand when navigated to


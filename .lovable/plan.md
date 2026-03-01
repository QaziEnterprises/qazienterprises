

## Fix: Blank White Screen on Published/New Tab

### Problem
The app shows a completely blank white screen because `AppRoutes` returns `null` when either:
- Auth `loading` is stuck at `true` (auth state never resolves)
- `ready` is stuck at `false` (`initializeDefaultData` never completes)

There are no visible errors — the app just silently renders nothing.

### Root Causes
1. **No loading fallback**: `if (loading || !ready) return null` renders absolutely nothing — not even a spinner
2. **No error handling in auth init**: If `supabase.auth.getSession()` or `fetchRole()` throws unexpectedly, `setLoading(false)` never fires
3. **No error handling in data init**: If `initializeDefaultData().then(...)` has an unhandled rejection, `setReady(true)` never fires
4. **No global error boundary**: Any unhandled React render error crashes to a white screen with no recovery

### Fix Plan

#### 1. Add a loading spinner instead of returning null
Replace `return null` with a visible loading indicator so users always see something.

#### 2. Add try/catch and timeout safety in AppRoutes
- Wrap `initializeDefaultData()` call with `.catch()` to always set `ready = true` even on failure
- Add a safety timeout (5 seconds) that forces `ready = true` if initialization hangs

#### 3. Add try/catch in useAuth.tsx
- Wrap both `onAuthStateChange` and `getSession` callbacks in try/catch blocks
- Ensure `setLoading(false)` always fires, even if `fetchRole` throws

#### 4. Add a React Error Boundary
- Create an `ErrorBoundary` component that catches render errors
- Wrap the entire app to prevent white-screen crashes
- Show a friendly "Something went wrong" message with a reload button

#### 5. Add global unhandled rejection handler
- In `App.tsx`, add a `window.addEventListener('unhandledrejection', ...)` to catch any missed promise errors and show a toast notification

### Files to Change
- **src/App.tsx** — Add loading spinner, error boundary, safety timeout, unhandled rejection handler
- **src/hooks/useAuth.tsx** — Add try/catch around all async operations

### Technical Details

**App.tsx changes:**
```text
AppRoutes:
- Replace `return null` with a centered loading spinner
- Add .catch() to initializeDefaultData promise
- Add 5-second safety timeout for initialization
- Add unhandled promise rejection listener
- Wrap app tree in ErrorBoundary component

New ErrorBoundary class component:
- Catches React render errors
- Shows error message with reload button
- Prevents blank white screen on crashes
```

**useAuth.tsx changes:**
```text
- Wrap onAuthStateChange callback body in try/catch
- Wrap getSession().then callback body in try/catch  
- Both catch blocks: log error, set loading=false
- Wrap fetchRole in try/catch (set role to "user" on failure)
```


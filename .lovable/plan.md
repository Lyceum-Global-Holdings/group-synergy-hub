# Fix: sidebar module switch feels like a full page refresh

## What's actually happening

The sidebar links (`CompanySidebar` → `NavLink to=...`) are correct SPA links — there is no real browser reload, no auth loss, no `window.location` redirect.

What the user perceives as "the system gets refreshed" is this:

1. Almost every route in `src/App.tsx` is wrapped with `React.lazy(() => import(...))`.
2. The inner Suspense in `ProtectedLayout` uses `PageLoader`, which is a **full-viewport** spinner:
   ```tsx
   <div className="flex items-center justify-center min-h-screen">
     <Loader2 className="animate-spin" />
   </div>
   ```
3. When you click a module/submodule, React Router commits the URL change synchronously, the lazy chunk for the next page suspends, and Suspense **replaces the entire content area** with that `min-h-screen` spinner until the chunk finishes downloading. That blank-white-with-spinner frame is exactly the "white flash + URL changes" symptom.

The console also confirms it: React Router is warning about `v7_startTransition`. Without that flag, route transitions are not wrapped in `startTransition`, so Suspense throws the fallback immediately instead of keeping the previous screen visible while the next chunk loads.

## Fix (frontend only, scoped to `src/App.tsx`)

### 1. Opt into React Router's `startTransition` for navigations

```tsx
<BrowserRouter
  future={{
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  }}
>
```

With this flag, every `NavLink`/`navigate(...)` is wrapped in `React.startTransition`. Combined with Suspense, React keeps the **previous route mounted and visible** while the new lazy chunk loads. No more full-screen wipe.

### 2. Replace the inner page-level fallback with a non-blocking indicator

The outer `Suspense` (around `<Routes>`) can keep `PageLoader` for cold start. The inner one inside `ProtectedLayout` is what causes the wipe on every navigation. Change it so it does **not** replace the whole content:

- Use `null` as the inner Suspense fallback (preferred when paired with `v7_startTransition`, because the previous page stays visible during the transition), **or**
- Render a thin top progress strip (e.g. a 2px `bg-primary` bar absolutely positioned at the top of the content area) that overlays without unmounting the current page.

Recommended: `<Suspense fallback={null}>` for the inner one, since the outer Suspense already covers first paint and the transition flag handles in-app navigation.

### 3. (Optional, small win) Prefetch lazy chunks on hover

In `CompanySidebar`, on `onMouseEnter`/`onFocus` of each `NavLink`, call the matching `import('./pages/...')`. This is a follow-up and not required for the fix.

## Out of scope

- No changes to auth, queries, routing structure, or any business logic.
- No changes to `CompanySidebar` link behavior — `NavLink` is already correct.
- The unrelated `validateDOMNesting` warning from `FormBuilder.tsx` (Badge `<div>` inside `<p>`) is a separate cosmetic warning and not addressed here.

## Verification

1. Open the app, click between `Sourcing → Supplier Registration`, `Warehouse → Inventory`, `Finance → Payments`, etc.
2. Confirm the URL updates and the new page renders **without** the previous content disappearing into a blank white frame.
3. First-ever navigation to a not-yet-downloaded chunk may still show a brief inline indicator, but the layout/sidebar/header stay mounted — no full refresh feel.
4. Console no longer prints the `v7_startTransition` future-flag warning.

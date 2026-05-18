# Speed up submodule navigation

The wait after clicking a sidebar submodule is mostly two things stacked back-to-back:

1. **JS chunk download** — each page is `React.lazy(...)`, so the browser fetches its JS bundle on the first click.
2. **Page boot data fetch** — the page mounts and only then fires its Supabase queries; until they resolve the page is blank or shows a spinner.

We'll attack both, without breaking the current code-split architecture.

## What we'll do

### 1. Prefetch chunks on intent (biggest win)
- Convert each `React.lazy(() => import(...))` entry in `src/App.tsx` to use a small `lazyWithPrefetch` helper that exposes the underlying `import()` so we can trigger it on demand.
- In `src/components/layout/AppSidebar.tsx`, attach `onMouseEnter` / `onFocus` / `onTouchStart` to each `NavLink` to call the matching prefetch. By the time the user actually clicks, the JS chunk is usually already in cache → click feels instant.
- Add an `requestIdleCallback`-driven background prefetch for the user's top modules (Warehouse, Procurement, Finance) after the dashboard is idle.

### 2. Render a route shell instantly
- Replace the current page-wide spinner fallback with a lightweight skeleton (header + table skeleton) inside `<Suspense fallback={...}>` so the layout paints immediately and only the content area shows loading. Perceived latency drops dramatically even when the chunk still has to download.
- Keep `AppLayout` (sidebar/header) outside the Suspense boundary so it never re-renders on navigation.

### 3. Make first paint of each page cheaper
- Audit the 3–4 slowest submodules (Inventory, GRN, StockAudit, ItemBinMaster) for:
  - Top-level `useEffect` chains that block first render → move to `useDeferredValue` / `startTransition`.
  - Heavy children (tabs, dialogs) that should also be `lazy` inside the page so the first tab renders before the others' code is parsed.
  - React Query calls that can opt into `placeholderData: keepPreviousData` so re-entering a page shows old data while it refreshes.

### 4. Warm the data cache from the sidebar
- For a small set of "expensive list" pages, on sidebar hover also call `queryClient.prefetchQuery(...)` for the page's primary list RPC (e.g. `list_warehouse_inventory`). On click, the page mounts with data already in cache → no spinner.

### 5. Lock in the improvement
- Add a tiny perf marker via the existing `markRouteChange` to log click→first-content time, so we can confirm the win in the PerfOverlay and catch regressions.

## Out of scope
- No backend/RLS/RPC changes. No design changes. No new dependencies.

## Technical notes

```ts
// src/lib/lazyWithPrefetch.ts
export function lazyWithPrefetch<T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
) {
  const Component = React.lazy(loader);
  (Component as any).preload = loader;
  return Component as React.LazyExoticComponent<T> & { preload: () => Promise<unknown> };
}
```

Sidebar wiring:
```tsx
<NavLink
  to={item.url}
  onMouseEnter={() => item.preload?.()}
  onFocus={() => item.preload?.()}
>
```

Each `departments[].items[]` entry gets an optional `preload` field pointing at the matching `lazyWithPrefetch` component's `.preload`.

## Rollout order
1. Add `lazyWithPrefetch` + convert `App.tsx` lazies.
2. Wire sidebar hover/focus prefetch.
3. Swap Suspense fallback to a skeleton shell.
4. Add React Query `prefetchQuery` warmers for the top 4–6 heaviest pages.
5. Idle-time background prefetch for the user's home department.
6. Verify with PerfOverlay; iterate on any page still >500ms click→paint.

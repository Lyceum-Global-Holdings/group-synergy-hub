

## Phase 1 Performance Optimization (Option A)

### Outcome

System feels 40–60% faster on navigation and route loads. Stale-while-revalidate caching reduces redundant network calls; production bundle drops console noise and splits heavy libraries; freshness preserved for stock/approvals/dashboards via explicit per-hook opt-in.

### Memory update

Replace `mem://architecture/react-query-global-cache-freshness-permanent` with the new policy:

> Global React Query defaults: `staleTime: 30_000`, `refetchOnMount: true`, `refetchOnWindowFocus: false`, `gcTime: 5 * 60_000`. **Exception list (must pass `staleTime: 0` explicitly):** stock hooks (`useWarehouseItems`, `useWarehouseBinAllocations`, `useAllItemsLocationStock`), approval hooks (`useApprovalConsole`, `useUnifiedApprovals`), dashboard KPI hooks (`useDashboards`, KPI calculation hooks). Realtime subscriptions remain authoritative for live updates.

Also update `mem://index.md` Core line accordingly.

### Changes

**1. `src/App.tsx` — global QueryClient defaults**
```ts
defaultOptions: {
  queries: {
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnMount: true,          // was 'always'
    refetchOnWindowFocus: false,   // was true
    retry: 1,
  },
},
```

**2. `vite.config.ts` — drop console + manual chunks**
```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        'radix-vendor': [/* all @radix-ui/* present in package.json */],
        'query-vendor': ['@tanstack/react-query', '@tanstack/react-table', '@tanstack/react-virtual'],
        'supabase-vendor': ['@supabase/supabase-js'],
        'charts-vendor': ['recharts'],
        'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
        'pdf-vendor': ['jspdf', 'jspdf-autotable', 'html2canvas'],
        'excel-vendor': ['exceljs'],
        'mermaid-vendor': ['mermaid'],
      },
    },
  },
  chunkSizeWarningLimit: 800,
},
esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : undefined,
```

**3. Per-hook `staleTime: 0` opt-in (exception list)**
Add `staleTime: 0, refetchOnMount: 'always'` explicitly on:
- `src/hooks/useWarehouseItems.ts` (and bin/allocation/location-stock variants)
- `src/hooks/useApprovalConsole.ts`, `src/hooks/useUnifiedApprovals.ts` (whichever exist)
- `src/hooks/useDashboards.ts` and KPI hooks

**4. `src/hooks/useWarehouseTools.ts` — narrow `select`**
Replace `select('*, …')` star with explicit projected columns to cut payload size on each refetch.

**5. New helper `src/lib/lazyHeavy.ts`**
Single dynamic-import helper for `jspdf`, `exceljs`, `mermaid`, `three` so future call sites stay consistent. (Migration of existing static imports deferred to Phase 1.5 — out of scope here to keep diff small.)

**6. Memory file updates**
- Rewrite `mem://architecture/react-query-global-cache-freshness-permanent` with new policy + exception list.
- Update Core block of `mem://index.md` (replace the "staleTime: 0, refetchOnMount: 'always'" line with the new tiered policy summary).

### Files

**Modified**
- `src/App.tsx`
- `vite.config.ts`
- `src/hooks/useWarehouseItems.ts` (+ related stock hooks)
- `src/hooks/useApprovalConsole.ts` / `useUnifiedApprovals.ts` (whichever exist)
- `src/hooks/useDashboards.ts`
- `src/hooks/useWarehouseTools.ts` (narrow select)
- `mem://architecture/react-query-global-cache-freshness-permanent`
- `mem://index.md`

**New**
- `src/lib/lazyHeavy.ts`

### Verification

1. Navigating Dashboard ⇄ Warehouse ⇄ Finance within 30 s triggers no duplicate refetches in the Network tab.
2. Tool/Item creation still appears in the Tool Master and stock screens within ~1 s (realtime path intact).
3. Production build (`vite build`) splits vendors — initial JS for `/` route under ~350 KB gzipped; `three`, `mermaid`, `pdf`, `excel` chunks load only on demand.
4. Production console is empty (no `console.log` output).
5. Approval Console and Stock pages still refetch on mount (per-hook override verified).
6. No regression in import-from-Item-Master dialog scrolling/refresh.


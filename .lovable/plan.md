

# Fix: PWA Service Worker Caching Stale Data

## Root Cause

The `vite.config.ts` has a PWA Workbox configuration that **caches all Supabase API responses** for up to 24 hours:

```typescript
runtimeCaching: [
  {
    urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
    handler: "NetworkFirst",
    options: {
      cacheName: "supabase-cache",
      expiration: {
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 // 24 hours
      }
    }
  }
]
```

While "NetworkFirst" prioritizes the network, when there are any connectivity hiccups, timeouts, or slow responses, the service worker falls back to serving **cached (old) data**. This means:
- Inventory items show old data after updates
- Daily Site Reports show stale report data
- Any new records added don't appear until the cache expires (up to 24 hours)

This directly contradicts the project's permanent architecture standard of `staleTime: 0` and `refetchOnMount: 'always'` -- React Query fetches fresh data, but the service worker intercepts the network request and can return cached responses before React Query even sees the real data.

## Fix

### File: `vite.config.ts`

**Remove the Supabase runtime caching entirely.** API data should never be cached by the service worker -- React Query already handles data freshness. Only static assets (JS, CSS, fonts, images) should be cached by the PWA.

Updated workbox config:

```typescript
workbox: {
  maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
  globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
  // No runtimeCaching for Supabase API -- data must always be fresh
  navigateFallback: "index.html",
  navigateFallbackDenylist: [/^\/api/],
  // Force the new service worker to activate immediately
  skipWaiting: true,
  clientsClaim: true,
}
```

Key changes:
1. **Remove `runtimeCaching`** for Supabase URLs -- no more stale API data
2. **Add `skipWaiting: true`** -- new service worker activates immediately instead of waiting for all tabs to close
3. **Add `clientsClaim: true`** -- new service worker takes control of all open tabs immediately
4. **Add `navigateFallback`** -- ensures SPA routing works offline

## Why This Is a Permanent Fix

Previously, every time data appeared stale, the symptoms looked like a React Query or RLS issue. The actual interceptor was the service worker silently serving cached API responses. By removing API caching from the service worker entirely:
- React Query's `staleTime: 0` will work as intended
- All data fetches go directly to Supabase (no middleman cache)
- Publishing updates will immediately show new code (via `skipWaiting` + `clientsClaim`)
- Static assets (JS, CSS, images) are still cached for performance

## Summary

One file change (`vite.config.ts`) that permanently resolves the recurring "data not showing after update" issue by eliminating the service worker's API response cache.

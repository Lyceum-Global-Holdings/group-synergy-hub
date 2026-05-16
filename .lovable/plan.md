## Problem

Whenever the user picks a different company (or "All Companies") in the header, the app jumps back to `/` (dashboard). Same thing happens visually when the location changes because the company switch triggered the redirect first. This makes it impossible to stay on a module page (e.g. `/warehouse/inventory`) while switching the company/location context — the user is bounced to the dashboard every time.

## Root cause

`src/components/common/CompanySelector.tsx` explicitly forces navigation:

```ts
onValueChange={(value) => {
  // ...setSelectedCompany(...)
  if (location.pathname !== '/') {
    navigate('/');                // ← this is the “auto refresh”
  }
}}
```

`CompanyContext` already propagates the selection through React context, so every page re-renders with the new `company_id` automatically. The `navigate('/')` is leftover and unnecessary.

`LocationSelector` does not navigate — it only updates `LocationFilterContext`, which is already the correct pattern.

## Fix

1. In `src/components/common/CompanySelector.tsx`:
   - Remove the `useNavigate` / `useLocation` imports and the `navigate('/')` call inside `onValueChange`.
   - Keep `setSelectedCompany(...)` so context still updates instantly.

2. Smoke-check the pages that depend on `selectedCompany` (Inventory, BinAllocations, Warehouse Network, Approval Console) by reading their hooks — they already key React Query off `selectedCompany?.id`, so removing the redirect won't leave stale data. No code changes expected here; just verify.

3. No DB, RLS, or backend changes. No changes to `LocationSelector` or `LocationFilterContext`.

## Out of scope

- Persisting the selected company/location across reloads (already handled via context defaults).
- Changing how modules read the active company — they already react to context.

## Acceptance

- On `/warehouse/inventory`, changing the company in the header updates the data shown but keeps the user on `/warehouse/inventory`.
- Same for changing the location.
- Dashboard (`/`) still works as before.

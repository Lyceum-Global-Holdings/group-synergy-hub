

# Fix: Production Module Not Visible (404)

## Root Cause

The Production module was added to `AppSidebar.tsx`, but the application actually uses `CompanySidebar.tsx` for navigation, which renders modules based on `moduleConfig` in `src/constants/moduleConfig.ts`. Since there is no `production` entry in `moduleConfig`, the Production module never appears in the sidebar and the route appears as a 404 because users cannot navigate to it.

## Changes Required

### 1. Add `production` to `moduleConfig.ts`
Add a new `production` module entry with the Factory icon and a single sub-module for the Production Dashboard at `/production`.

### 2. No other changes needed
- The route `/production` already exists in `App.tsx` (line 247)
- The page component and all sub-components already exist
- The database tables are already created
- `AppSidebar.tsx` changes from the earlier implementation are harmless but redundant

Once `production` is added to `moduleConfig`, super admins or companies with the production module allocated will see it in the sidebar and can navigate to `/production`.


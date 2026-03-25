

## Add Error Boundaries and User-Friendly Error Messages to Finance Reports

### Problem
Currently, report components show raw error messages (`error.message`) directly to the user, and there are no React Error Boundaries to catch rendering crashes. A database or network error displays unfriendly text like "column coa.parent_id does not exist".

### Plan

**1. Create a reusable `ReportErrorBoundary` component**
- File: `src/components/finance/reports/ReportErrorBoundary.tsx`
- React class component implementing `componentDidCatch`
- Renders a styled Card with an alert icon, friendly title ("Something went wrong"), a human-readable description, a "Try Again" button that resets the boundary, and a collapsible "Technical Details" section showing the raw error
- Accepts optional `onReset` callback prop

**2. Create a reusable `ReportErrorMessage` inline component**
- File: `src/components/finance/reports/ReportErrorMessage.tsx`
- Functional component for query-level errors (the current inline `error` states)
- Maps common error patterns to friendly messages (e.g., "column ... does not exist" → "Report configuration issue — please contact support", network errors → "Unable to connect", permission errors → "You don't have access")
- Shows a retry button using react-query's `refetch`
- Renders as a styled Alert with icon, not raw red text

**3. Update 4 report components to use both**
- `ProfitLossReport.tsx`, `BalanceSheetReport.tsx`, `CashFlowReport.tsx`, `AgingReport.tsx`
- Wrap each report's return in `<ReportErrorBoundary>` for crash protection
- Replace the inline `error.message` divs with `<ReportErrorMessage error={error} onRetry={refetch} />`

**4. Wrap the `ReportsModule` tabs content**
- Add a top-level `<ReportErrorBoundary>` around each `<TabsContent>` that renders a live report, so any unhandled crash in a single tab doesn't break the entire module

### Files to Create
- `src/components/finance/reports/ReportErrorBoundary.tsx`
- `src/components/finance/reports/ReportErrorMessage.tsx`

### Files to Edit
- `src/components/finance/reports/ProfitLossReport.tsx` — wrap + replace error div
- `src/components/finance/reports/BalanceSheetReport.tsx` — wrap + replace error div
- `src/components/finance/reports/CashFlowReport.tsx` — wrap + replace error div
- `src/components/finance/reports/AgingReport.tsx` — wrap + replace error div
- `src/components/accounting/reports/ReportsModule.tsx` — wrap tab contents


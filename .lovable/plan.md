

## In-App Test Environment — Module Testing Dashboard

### Overview
Build a dedicated **Test Environment** page (`/admin/test-environment`) accessible to Super Admins. It provides an interactive dashboard to run automated smoke tests against every module's core operations (CRUD, API connectivity, RLS policies, edge functions) with real-time pass/fail results — aligned with **ISO 29119** (Software Testing) and **ISTQB** test execution standards.

### Architecture

```text
/admin/test-environment
├── TestEnvironmentPage.tsx        ← Main dashboard
├── components/
│   ├── TestSuiteRunner.tsx        ← Orchestrates test execution
│   ├── TestCategoryCard.tsx       ← Module-level card with expand/collapse
│   ├── TestCaseResult.tsx         ← Individual test row (pass/fail/skip/running)
│   ├── TestSummaryHeader.tsx      ← Overall stats (total, passed, failed, duration)
│   └── TestReportExport.tsx       ← Export results as CSV/JSON
├── hooks/
│   └── useTestSuite.ts            ← State management for test execution
└── tests/
    ├── authTests.ts               ← Authentication & session tests
    ├── warehouseTests.ts          ← Warehouse module tests (13 sub-modules)
    ├── procurementTests.ts        ← Procurement module tests (9 sub-modules)
    ├── sourcingTests.ts           ← Sourcing module tests (6 sub-modules)
    ├── financeTests.ts            ← Finance module tests (11 sub-modules)
    ├── constructionTests.ts       ← Construction module tests (11 sub-modules)
    ├── productionTests.ts         ← Production module tests
    ├── salesTests.ts              ← TUH/Sales module tests (4 sub-modules)
    ├── managementTests.ts         ← Management module tests (5 sub-modules)
    ├── socialMediaTests.ts        ← Social media module tests
    ├── adminTests.ts              ← Administration module tests
    ├── edgeFunctionTests.ts       ← Edge function connectivity tests (10 functions)
    └── rlsTests.ts                ← RLS policy validation tests
```

### Test Categories (12 Suites, ~120 Test Cases)

| Suite | Tests | What It Validates |
|-------|-------|-------------------|
| **Authentication** | 6 | Login, session, token refresh, role resolution, super admin check |
| **Warehouse** | 15 | Item master CRUD, GRN create/list, stock transfer, asset tracking, batch FIFO |
| **Procurement** | 12 | PR create, PO lifecycle, RFQ, 3-way match, MDP calculation, BOM explosion |
| **Sourcing** | 8 | Supplier CRUD, evaluation scoring, contract management, blacklist |
| **Finance** | 14 | GL entries, AP/AR, bank reconciliation, budget CRUD, fixed assets, cost centers |
| **Construction** | 15 | Project CRUD, site management, floor plans, work orders, DSR, safety incidents |
| **Production** | 8 | Sector/stage setup, production orders, daily entries, WIP cost calculation |
| **Sales (TUH)** | 6 | Customer master, CPO lifecycle, finished goods, demand overview |
| **Management** | 6 | Dashboard access, approval console, audit log retrieval, budget vs actual |
| **Social Media** | 4 | Account registry, access management, NDA compliance, activity log |
| **Edge Functions** | 10 | Connectivity test for all 10 deployed edge functions |
| **RLS & Security** | 8 | Company-scoped isolation, role-based access, cross-company visibility |

### Each Test Case Structure
Every test follows a standardized format:
- **ID**: Unique identifier (e.g., `WH-001`)
- **Name**: Descriptive test name
- **Category**: Module grouping
- **Priority**: Critical / High / Medium
- **Test Function**: Async function that runs a Supabase query or API call and returns pass/fail with details
- **Expected Result**: What constitutes a pass
- **Actual Result**: Runtime output
- **Duration**: Execution time in ms

### How Tests Work
Each test is a lightweight async function that:
1. Calls `supabase.from('table').select()` or `supabase.rpc()` to verify table accessibility
2. Attempts a test insert → verify → delete cycle (using a `test_` prefix for cleanup)
3. Calls edge functions via `supabase.functions.invoke()` to verify deployment
4. Checks RLS by verifying company-scoped results match expectations
5. Reports pass/fail with error details and timing

### UI Design
- **Summary Header**: Total tests, passed (green), failed (red), skipped (gray), total duration
- **Module Cards**: Collapsible cards per module with progress bar and individual test rows
- **Run Controls**: "Run All", "Run Suite", "Run Single Test" buttons
- **Export**: Download results as timestamped CSV or JSON
- **Color Coding**: Green checkmark (pass), red X (fail), yellow spinner (running), gray dash (skipped)
- Navy/Gold branding consistent with the rest of the platform

### Standards Alignment
- **ISO 29119-3**: Test case documentation structure (ID, preconditions, steps, expected results)
- **ISO 29119-4**: Test execution procedures (suite → case → result → report)
- **ISTQB Foundation**: Test levels (unit → integration → system), traceability matrix
- **ISO 27001**: Security testing (RLS validation, authentication checks)

### Implementation Steps
1. Create test definition files for all 12 suites in `src/pages/admin/test-environment/tests/`
2. Build `useTestSuite` hook for async test orchestration with progress tracking
3. Build UI components (summary header, category cards, result rows, export)
4. Create main `TestEnvironmentPage.tsx` with routing
5. Add route to `App.tsx` and register in `moduleConfig.ts` under Administration
6. Protect with `SuperAdminRoute` wrapper

### Safety
- All write tests use a `test_` prefix and clean up after themselves (insert → assert → delete)
- Tests run against the **live database** but only touch test-prefixed records
- No destructive operations on real data
- Edge function tests only verify reachability (HTTP 200/401), not side effects


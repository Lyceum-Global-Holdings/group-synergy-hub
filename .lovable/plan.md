

## Scroll-to-top on route change inside `#app-scroll-container`

### Outcome

When the user navigates between routes (sidebar links, breadcrumbs, programmatic `navigate()`), the main content area (`#app-scroll-container`) resets to scrollTop = 0. Browser back/forward navigations preserve their natural scroll position (standard UX expectation).

### International standard

- **NN/g navigation guideline**: a new page should start at the top so users see the page title and primary content first.
- **W3C HTML scroll restoration spec**: `POP` history actions (back/forward) should restore prior scroll; `PUSH`/`REPLACE` (new navigation) should reset.

### Implementation

**1) New component `src/components/layout/ScrollToTop.tsx`**

A headless component that:
- Reads `useLocation()` (`pathname` only — not `search`/`hash`, so tab switches via query params and in-page anchors don't reset scroll unexpectedly).
- Reads `useNavigationType()` from `react-router-dom`.
- On `pathname` change, if navigation type is `PUSH` or `REPLACE`, find `document.getElementById('app-scroll-container')` and set `scrollTop = 0`. For `POP`, do nothing (preserve back/forward position).
- If the element isn't found (e.g. unauthenticated routes outside `AppLayout`), fall back to `window.scrollTo(0, 0)`.
- Uses `useLayoutEffect` so the reset happens before the user sees the new page paint (no flash of mid-scroll content).
- Returns `null`.

**2) Mount it inside the Router in `src/App.tsx`**

Place `<ScrollToTop />` as the first child inside `<BrowserRouter>` (or whichever router wrapper is used) so it sits above `<Routes>` and runs on every route change.

### Out of scope

- No changes to `AppLayout.tsx` — `#app-scroll-container` already exists from the previous plan.
- No changes to anchor (`#hash`) navigation behavior.
- No changes to in-page tab/filter state that uses query strings.

### Verification

1. Scroll deep into the Inventory tab → click any sidebar link → new page opens at the top.
2. Scroll deep into a page → click browser Back → previous page restores its scroll position.
3. Switch tabs within the same route (query string change) → scroll position is preserved.
4. Routes outside `AppLayout` (e.g. login) still behave correctly via the `window` fallback.

### Files

- `src/components/layout/ScrollToTop.tsx` — new
- `src/App.tsx` — mount `<ScrollToTop />` inside the router


## Goal
Force normal document scrolling on `/register-supplier` by adding a CSS-based override (instead of relying solely on inline-style mutations in `useEffect`), so the public registration form is fully scrollable regardless of the global app-shell `overflow: hidden` lock.

## Why CSS over JS
The current `useEffect` in `PublicSupplierRegistration.tsx` mutates `style.overflow`/`style.height` on `html`, `body`, and `#root`, but inline styles can be re-asserted or overridden by stylesheet rules with higher specificity (e.g. `html, body, #root { ... }` in `src/index.css`). A CSS class with `!important` always wins, and toggling it on/off via `useEffect` is the standard, robust pattern.

## Changes

### 1. `src/index.css`
Add a scoped escape-hatch class that the public page can opt into:

```css
/* Public page scroll override — used by /register-supplier */
html.public-page-scroll,
html.public-page-scroll body,
html.public-page-scroll #root {
  height: auto !important;
  min-height: 100% !important;
  overflow: auto !important;
}
```

### 2. `src/pages/PublicSupplierRegistration.tsx`
Replace the inline-style `useEffect` with a class toggle on `<html>`:

```tsx
useEffect(() => {
  document.documentElement.classList.add("public-page-scroll");
  return () => {
    document.documentElement.classList.remove("public-page-scroll");
  };
}, []);
```

Keep the existing `min-h-screen` wrappers on the form / submitted / not-found views — no further markup changes required.

## Out of scope
- Global `html/body/#root` lock in `index.css` stays intact (Fiori-style app shell behavior preserved for authenticated routes).
- No route-config or `App.tsx` changes — the override is page-mounted.
- No changes to `DynamicSupplierForm`, schemas, or edge function.

## Verification
1. Open `/register-supplier?c=<slug>` in preview, confirm the page scrolls top-to-bottom and the submit button is reachable.
2. Navigate from `/register-supplier` to an authenticated route and confirm the app shell is still locked (no double scrollbars, sidebar/main scroll behavior unchanged).

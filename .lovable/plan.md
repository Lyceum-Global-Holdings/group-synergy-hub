## Root cause

`src/index.css` globally locks the document to the viewport so the app shell can use a single named scroll region:

```css
html, body, #root { height: 100%; overflow: hidden; }
```

That works for `/sourcing/...` because `AppLayout` provides its own `overflow-auto` `<main>`. But `/register-supplier` (the public supplier portal) renders **outside** `AppLayout`, and its outer wrapper is only `min-h-screen ... py-12 px-4` — no internal scroll container. So once the form is taller than the viewport, the content is clipped and the page can't be scrolled.

## Fix

Make the public registration page (and the success / not-found states) own its scroll, instead of relying on `body`.

In `src/pages/PublicSupplierRegistration.tsx`, replace the three `min-h-screen ...` wrappers with `h-screen overflow-y-auto ...` so the page itself becomes the scroll container:

```tsx
<div className="h-screen overflow-y-auto bg-gradient-to-br from-primary/5 to-secondary/5 py-12 px-4">
  ...
</div>
```

No other surfaces are touched — the app-shell scroll behavior, dialogs, and the in-app New Registration wizard continue to work as today.

## Why not change the global CSS

Removing the `html/body/#root { overflow: hidden }` lock would re-introduce double scrollbars across the entire authenticated app shell (it's an intentional Fiori-style pattern). Scoping the fix to the public route is safer and keeps the enterprise shell behavior intact.

## Files to edit

- `src/pages/PublicSupplierRegistration.tsx` — swap `min-h-screen` for `h-screen overflow-y-auto` on the three top-level wrappers (form view, submitted view, not-found view).

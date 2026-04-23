

## Fix global scroll: lock header + sidebar to viewport, scroll only the content/tables

### What's wrong today

- `AppLayout` uses `min-h-screen` on the outer wrapper. As soon as any page is taller (or wider) than the viewport, the **document** scrolls — so the header (`shrink-0`) scrolls out of view even though it's `sticky`-styled in intent.
- `<main className="flex-1 p-5 overflow-auto">` only works as the scroll container if its parent is **height-constrained** (`h-screen`, not `min-h-screen`). With `min-h-screen`, `flex-1` has no upper bound, so `overflow-auto` never activates.
- Wide tables (Inventory, Warehouse Management, DSR, Approvals, etc.) have no horizontal scroll wrapper, so they push the page horizontally — same root cause.
- The Radix sidebar is already `position: fixed h-svh` — it's correct. It only *appears* to scroll because the whole document scrolls under it.

### International standard being applied

- **NN/g enterprise UX guideline** "Persistent global navigation": top bar and primary nav stay visible at all times; only the work area scrolls.
- **WCAG 2.2 SC 1.4.10 Reflow**: content must remain usable without two-dimensional document scroll at 1280 CSS px; tables get their own horizontal scroll region.
- **SAP Fiori shell pattern**: fixed shell bar + fixed side navigation + scrollable page container — already the project's stated design system (`mem://style/modern-enterprise-design-system`).
- **Material Design "App bar – top, fixed"**: header pinned, content scrolls beneath.

### Solution — one canonical app shell

Make the layout a fixed-height flex column so the header and sidebar are viewport-locked and only `<main>` scrolls. Then give every table a horizontal scroll wrapper so wide tables never widen the page.

```text
┌─────────────────────────────────────────────────┐  h-svh, overflow-hidden
│  Sidebar (fixed)  │  Header (h-14, shrink-0)    │  ← always visible
│                   ├─────────────────────────────┤
│                   │  <main> flex-1 overflow-auto│  ← only scroller
│                   │   page content              │
│                   │   ┌───────────────────────┐ │
│                   │   │ Table wrapper         │ │  ← own x-scroll
│                   │   │  overflow-x-auto      │ │
│                   │   └───────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Changes

#### 1) `src/components/layout/AppLayout.tsx` — lock the shell

- Outer wrapper: replace `min-h-screen` with `h-svh overflow-hidden` (use `h-svh` for correct behavior with mobile browser chrome; `h-screen` fallback acceptable).
- Right column wrapper: add `h-svh` so the inner flex column has a hard ceiling.
- Header: keep `shrink-0` and add `sticky top-0` defensively (no-op when parent is height-locked, but protects against regressions).
- `<main>`: keep `flex-1 overflow-auto`, add `min-h-0` (required for flex children to allow inner overflow), and `overscroll-contain` so scroll chaining doesn't leak to the body.
- Add `id="app-scroll-container"` on `<main>` — useful for any "scroll to top on route change" logic (and matches enterprise convention of a single named scroll region).

#### 2) `index.html` / `src/index.css` — prevent body scroll

- In `src/index.css` add:
  - `html, body, #root { height: 100%; overflow: hidden; }`
  - This guarantees only the named `<main>` scroller scrolls, even if a page accidentally renders something outside the layout.

#### 3) `src/components/shared/DataTable.tsx` — table is the new scroll boundary

The shared table is used across modules — fixing it here fixes most pages at once.

- Wrap `<Table>` in `<div className="relative w-full overflow-x-auto">`.
- Keep the existing card/border wrapper on the outside; the new scroller goes inside it so the rounded corners and shadow are preserved.
- Add `min-w-full` on `<Table>` so narrow data still fills the wrapper.
- Optional but recommended (Fiori standard): make the `<TableHeader>` `sticky top-0 bg-card z-10` so column headers stay visible while scrolling **vertically inside the page** — only takes effect when a parent constrains height (e.g. dialogs, full-height list pages).

#### 4) Pages using raw `<Table>` instead of `DataTable`

For the small number of pages that render `<Table>` directly (not through `DataTable`), wrap them with the same `overflow-x-auto` container. Concretely audit and update:

- `src/pages/admin/WarehouseManagement.tsx`
- `src/components/warehouse/ItemMasterTab.tsx`
- any other tab files under `src/components/warehouse/` and `src/pages/construction/` that render `<Table>` directly

Apply the same `<div className="w-full overflow-x-auto rounded-lg border border-border/50 bg-card">` wrapper. No visual change when content fits; horizontal scroll appears only when needed.

#### 5) Mobile / responsive

- `h-svh` (small viewport height) handles iOS Safari URL bar collapse correctly.
- `SidebarProvider` already swaps to a `Sheet` (off-canvas) on mobile via the existing `useIsMobile` logic — no changes needed.
- Header remains visible on mobile because the same fixed-shell rule applies.

### Out of scope

- No changes to sidebar internals (`src/components/ui/sidebar.tsx`) — it is already correctly fixed.
- No changes to dialogs/sheets (their own scroll regions).
- No visual redesign of header, sidebar, or tables — only layout/overflow fixes.

### Verification

1. Open `/warehouse/item-bin-master` (current route) → scroll inside the table area; header and sidebar stay pinned.
2. Open Inventory tab on a company with many items → vertical scroll happens inside `<main>`; the table's own header stays visible at the top of the table when scrolling vertically; horizontal scroll appears only inside the table wrapper, never on `<body>`.
3. Resize to 1280 px wide → no horizontal `<body>` scrollbar (WCAG 1.4.10).
4. Resize to mobile (≤768 px) → sidebar becomes off-canvas; header still pinned.
5. iOS Safari → header doesn't get pushed off-screen when URL bar collapses (covered by `h-svh`).

### Files to modify

- `src/components/layout/AppLayout.tsx` — switch to fixed-height shell (`h-svh overflow-hidden`, `min-h-0` on main).
- `src/index.css` — add `html, body, #root { height: 100%; overflow: hidden; }`.
- `src/components/shared/DataTable.tsx` — wrap table in `overflow-x-auto`; sticky header.
- `src/pages/admin/WarehouseManagement.tsx` — wrap raw `<Table>` in horizontal scroller.
- `src/components/warehouse/ItemMasterTab.tsx` — same.
- Audit pass on other files rendering raw `<Table>` (small list) — apply the same wrapper.


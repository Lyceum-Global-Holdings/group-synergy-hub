## Problem

In the left sidebar (`src/components/layout/CompanySidebar.tsx`):

- Clicking a top-level module (Finance, Warehouse, …) does not expand its sub-list.
- Nested groups (e.g. Construction → Resource Allocation → Labour/Inventory/Subcontractor) do not toggle.
- Some sub-items don't navigate when clicked.

Root cause is the way Radix `Collapsible` is wired into the shadcn sidebar primitives:

1. The top-level `<CollapsibleTrigger asChild>` wraps `<SidebarMenuButton>`. SidebarMenuButton renders an inner `<button>` and the `Slot` merge silently drops the trigger's `onClick` in some renders because the button also receives `isActive` / className overrides at the same time.
2. The nested `<Collapsible>` is rendered as a direct child of `<SidebarMenuSub>` (a `<ul>`), with `<SidebarMenuSubItem>` (an `<li>`) inside the Collapsible — invalid `ul > div > li` markup that breaks click bubbling on some browsers.
3. The leaf row wraps `<SidebarMenuSubButton asChild>` around a `<NavLink>` inside a flex container alongside the pin button; the pin button's hover-only opacity layer (`group-hover/pin-row`) sometimes sits on top of the NavLink hit area.

## Fix

Edit only `src/components/layout/CompanySidebar.tsx`:

1. Convert both Collapsibles to **controlled** state with `useState` keyed by module/sub-item, initialised from `isGroupActive(...)`. This removes reliance on `defaultOpen` re-evaluation and makes toggling deterministic.
2. Replace `<CollapsibleTrigger asChild><SidebarMenuButton>…</SidebarMenuButton></CollapsibleTrigger>` with a plain `<SidebarMenuButton onClick={() => setOpen(!open)}>` (no asChild). Render `<CollapsibleContent>` as a sibling. Same pattern for the nested group.
3. Restructure the nested block so the `<Collapsible>` lives **inside** `<SidebarMenuSubItem>`, producing valid `ul > li > div` markup.
4. Wrap the leaf row's NavLink + pin button in a `relative` container, give the NavLink `relative z-[1]`, and the pin button `relative z-[2]` so neither layer steals clicks from the other while keeping the hover-reveal behavior.
5. Keep the existing chevron rotation by toggling a class based on the controlled `open` state instead of `data-state` on the parent.

No changes to routing, `moduleConfig`, pinning logic, RBAC filtering, or styles outside this file.

## Verification

- Sign in, confirm each department in `Modules` expands/collapses on click.
- Expand Construction → Resource Allocation → click Labour, Inventory, Subcontractor; confirm navigation and active highlight.
- Confirm the pin (📌) icon still toggles without expanding/collapsing the row.
- Confirm the active-route auto-expansion still works on a hard refresh of a deep URL (e.g. `/warehouse/inventory`).

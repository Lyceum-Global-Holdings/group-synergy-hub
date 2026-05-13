## Problem

In the current `CompanySidebar.tsx`, two pieces of UI only render when a single company is selected (`!isViewingAllCompanies && selectedCompany`):

1. **Pin (star) buttons** next to each leaf submodule and each nested child.
2. There is no separate issue with chevrons themselves, but in all-companies view the lack of pin buttons makes the row look "flat". For nested items (e.g. Construction → Resource Allocation → Labour/Inventory/Subcontractor), the expand chevron is rendered, but the children are also gated behind pin/visibility logic that hides UI affordances.

Super admin defaults to "All Companies" view, so both toggles disappear.

## Fix

Edit only `src/components/layout/CompanySidebar.tsx`:

1. **Resolve a target company for pinning in all-companies view.**
   - Add `pinTargetCompany = selectedCompany ?? companies[0] ?? null`.
   - Pass it down to `DepartmentCollapsible` and `NestedSubItem` as a new prop `pinTargetCompany`.

2. **Always render `SidebarPinButton` when `pinTargetCompany` exists**, regardless of `isViewingAllCompanies`.
   - Replace the `!isViewingAllCompanies && selectedCompany` guard around both pin button blocks (leaf row and nested child row) with `pinTargetCompany &&`.
   - Use `pinTargetCompany.id` as the `companyId` prop.

3. **Update `isItemPinned`** to also accept the all-companies case: when `selectedCompany` is null, check pins against `pinTargetCompany.id` instead. Implementation: `const pinCompanyId = selectedCompany?.id ?? pinTargetCompany?.id` inside the helper.

4. **Nested chevron reliability.** Confirm `NestedSubItem`'s `Collapsible` uses controlled `open` state — it already does. No structural change needed; just make sure the chevron click target (`SidebarMenuSubButton` with `onClick`) is not overlapped. Add `relative z-[1]` to the trigger button and keep the children list at default stacking so clicks always reach the toggle.

5. Keep all other behavior (badges, "Used by:" company chips in all-companies view) unchanged.

## Out of scope

- `moduleConfig`, routing, RBAC, pin persistence logic (`useSidebarPins`), `SidebarPinButton` internals.
- Any other sidebar component or page.

## Verification

- Super admin in "All Companies" view: each submodule row shows a pin star on hover; clicking pins to the first accessible company.
- Construction → Resource Allocation chevron expands/collapses Labour, Inventory, Subcontractor.
- Selecting a single company still pins to that company (existing behavior preserved).

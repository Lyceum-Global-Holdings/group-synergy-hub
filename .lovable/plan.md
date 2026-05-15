# Fix Location Selector Hierarchy Alignment

## Problem

In the global header `LocationSelector` dropdown, sub-locations (e.g. `LNQ-1F`, `LNQ-2F`, `LNQ-Roof Top`) are rendered with a flat `↳ ` ASCII prefix. Because every `SelectItem` already reserves a left checkmark gutter, all rows visually start at the same column and the `↳` glyph adds noise without conveying depth. Multi-level hierarchies (depth ≥ 2) cannot be distinguished.

## Goal

Render the location tree using the international convention used by SAP Fiori, Oracle Redwood, Material, and Fluent tree pickers:

- Parents and children are visually ordered as a tree (parent immediately followed by its descendants).
- Depth is communicated by left indentation of the **label**, not by an ASCII glyph.
- Indentation step is consistent (16px / 1rem per level).
- Parent rows use normal foreground; child rows can stay normal weight but indented — no decorative arrows.
- Long names truncate with ellipsis inside the fixed-width trigger/menu so indentation is preserved.

## Scope

Frontend only. One file: `src/components/common/LocationSelector.tsx`.
No data, RPC, or context changes. `EffectiveLocation.depth` is already returned by `get_effective_locations_for_company`; we use it directly and fall back to a computed depth if missing.

## Changes

### 1. Tree-order the visible locations

Replace the current flat `locations` array with a depth-first ordered array:

- Build a `childrenByParent` map from the filtered `locations`.
- Identify roots (items whose `parent_id` is null **or** whose parent is not in the visible set — important for permission-filtered views where a child may be visible without its parent).
- Walk depth-first, sorting siblings by `name` (case-insensitive, locale-aware via `localeCompare`).
- Emit `{ loc, depth }` entries. `depth` comes from `loc.depth` when present; otherwise computed from the walk.

### 2. Render each `SelectItem` with depth-based indentation

```tsx
<SelectItem key={loc.id} value={loc.id} className="pr-2">
  <span
    className="block truncate"
    style={{ paddingInlineStart: `${depth * 16}px` }}
    title={loc.name}
  >
    {loc.name}
  </span>
</SelectItem>
```

- Drop the `↳` prefix entirely.
- Use `paddingInlineStart` (logical property) so RTL locales mirror correctly.
- `truncate` + `title` keeps long names readable without breaking the indent column.

### 3. Keep "All Locations" at depth 0, unindented

No change to its rendering aside from sitting above the tree.

### 4. Widen the menu slightly so deep names don't clip

Add `className="min-w-[260px]"` to `SelectContent` (trigger stays `w-[200px]`). Radix already widens the menu to fit; this just sets a sensible floor so 2–3 levels of indent + name remain legible.

## Out of scope

- No changes to permission logic, fetching, or the underlying RPC.
- No changes to other location pickers in dialogs (those use different components).
- No change to the trigger button width or icon.

## Acceptance

- `Lyceum Nugegoda Quarters` appears as a parent; `LNQ-1F`…`LNQ-Roof Top` appear directly beneath it, indented one level.
- A grandchild (depth 2) would indent two levels.
- No `↳` characters in the menu.
- RTL rendering mirrors indentation automatically.
- Long names truncate with `…` instead of wrapping.

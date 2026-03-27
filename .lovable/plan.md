

## Modern Enterprise UI Redesign - Design System First (SAP Fiori / Oracle-inspired)

### Approach
Update the design tokens (CSS variables), core UI components, and layout shell so the entire system inherits a modern enterprise look automatically. No page-by-page changes needed -- all 50+ pages inherit the refreshed design through shared components.

### Design Direction
Inspired by SAP Fiori 3.0 and Oracle Redwood: clean typography, generous whitespace, subtle depth through layered surfaces, refined color palette with semantic meaning, and professional data density.

### 1. Update Design Tokens (`src/index.css`)
- **Background**: Shift from flat gray to a warmer, layered surface system (shell > page > card > elevated)
- **Primary**: Refined enterprise blue with better contrast ratios (WCAG AAA)
- **Border**: Softer, less visible borders -- surfaces separated by elevation not lines
- **Shadows**: Replace current shadows with a 3-tier elevation system (subtle, medium, raised)
- **Typography**: Add `--font-display` and `--font-body` CSS vars; use Inter/system font stack
- **Radius**: Increase from `0.5rem` to `0.625rem` for a softer, modern feel
- **Spacing**: Tighter header (py-2 to h-14 fixed), more breathing room in content areas
- **New tokens**: `--surface-1`, `--surface-2`, `--surface-3` for layered depth; `--border-subtle` for lighter separators

### 2. Update Core UI Components

**Card** (`src/components/ui/card.tsx`)
- Remove visible border, use subtle shadow for elevation
- Slightly larger border-radius
- Add hover state with elevated shadow for interactive cards

**Button** (`src/components/ui/button.tsx`)
- Fiori-style: slightly taller (h-9 default), more horizontal padding
- Primary: solid fill with subtle gradient
- Ghost/outline: refined hover states with smooth transitions
- Add `emphasized` variant for primary CTAs

**Table** (`src/components/ui/table.tsx`)
- Zebra striping with very subtle alternating backgrounds
- Sticky header with surface elevation
- Refined header: uppercase text-xs tracking-wider, lighter weight
- Tighter row height for data density

**Input/Select** (`src/components/ui/input.tsx`, `src/components/ui/select.tsx`)
- Bottom-border style (Fiori-like) or refined bordered with lighter border color
- Focused state: primary color bottom border highlight
- Slightly reduced height (h-9) for density

**Badge** (`src/components/ui/badge.tsx`)
- Add `success`, `warning`, `info` variants using semantic tokens
- Softer pill shape, lighter backgrounds

**Tabs** (`src/components/ui/tabs.tsx`)
- Fiori-style: underline active indicator instead of background pill
- Cleaner, more spacious tab items

**Dialog** (`src/components/ui/dialog.tsx`)
- Softer overlay (black/50 instead of black/80)
- Refined shadow and radius
- Header with subtle bottom border separator

### 3. Redesign Layout Shell

**Header** (`src/components/layout/AppLayout.tsx`)
- Fixed height `h-14`, cleaner horizontal layout
- Remove gradient logo box -- use text-based branding or simple icon
- Subtle bottom shadow instead of heavy border
- Right-side controls: refined spacing, smaller selectors

**Sidebar** (`src/components/layout/CompanySidebar.tsx`)
- Fiori shell bar style: darker surface (`--sidebar-background` adjusted to a refined dark blue-gray)
- Active item: left accent bar (3px primary-colored left border) instead of background fill
- Group headers: smaller, uppercase, tracked-wider
- Icons: consistent 18px, muted until active
- Smooth expand/collapse transitions

### 4. Shared Components Polish

**DataTable** (`src/components/shared/DataTable.tsx`)
- Wrap in card with no visible border (shadow only)
- Add optional toolbar area for search/filters
- Loading skeleton: refined shimmer animation

**StatusBadge** (`src/components/shared/StatusBadge.tsx`)
- Use new semantic color tokens
- Add subtle dot indicator before text (Fiori pattern)

**ModuleSubTabs** (`src/components/accounting/ModuleSubTabs.tsx`)
- Switch to underline-style tabs matching the new Tabs component

### 5. Global Styles (`src/index.css`, `src/App.css`)
- Clean up `src/App.css` (remove Vite boilerplate styles)
- Add smooth scrollbar styling
- Add subtle page transition feel
- Font smoothing: antialiased rendering
- Selection color matching primary

### Files to Edit
- `src/index.css` -- design tokens overhaul
- `src/App.css` -- clean up legacy styles
- `src/components/ui/card.tsx` -- elevation-based design
- `src/components/ui/button.tsx` -- refined variants
- `src/components/ui/table.tsx` -- enterprise data table styling
- `src/components/ui/input.tsx` -- refined input styling
- `src/components/ui/badge.tsx` -- semantic variants
- `src/components/ui/tabs.tsx` -- underline active indicator
- `src/components/ui/dialog.tsx` -- softer overlay and polish
- `src/components/layout/AppLayout.tsx` -- modern header
- `src/components/layout/CompanySidebar.tsx` -- Fiori-style sidebar
- `src/components/shared/DataTable.tsx` -- card wrapper and polish
- `src/components/shared/StatusBadge.tsx` -- dot indicator
- `src/components/accounting/ModuleSubTabs.tsx` -- underline tabs
- `tailwind.config.ts` -- add new color tokens

### Technical Notes
- All changes are to shared/base components -- no individual page edits needed
- The ~50+ page components will automatically inherit the new look
- Fully backward compatible: no prop changes, no API changes
- Dark mode tokens updated in parallel
- WCAG AA contrast ratios maintained throughout


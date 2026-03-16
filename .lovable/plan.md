

# Fix: Item list misalignment within the Import from Catalog dialog frame

## Problem

The item list rows inside the `ScrollArea` are not properly constrained to the dialog frame, causing visual misalignment. The Radix `ScrollAreaPrimitive.Viewport` sets `w-full` but the inner content div has no width constraint, allowing button content to push beyond the visible frame boundary.

## Changes

### File: `src/components/warehouse/AddFromCatalogDialog.tsx`

**Line 281**: Add `overflow-hidden` to the inner wrapper div so item rows are clipped to the ScrollArea boundary:

```typescript
// Before:
<div>

// After:
<div className="overflow-hidden">
```

**Line 273**: Add `overflow-hidden` to the ScrollArea to ensure the border frame clips content:

```typescript
// Before:
<ScrollArea className="h-[400px] border rounded-md">

// After:
<ScrollArea className="h-[400px] border rounded-md overflow-hidden">
```

**Line 285**: Constrain button width with `max-w-full` to prevent flex children from expanding beyond the container:

```typescript
// Before:
<button className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-start justify-between gap-4 border-b last:border-b-0 cursor-pointer"

// After:
<button className="w-full max-w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-start justify-between gap-4 border-b last:border-b-0 cursor-pointer overflow-hidden"
```

These three small class additions ensure the item list stays within the dialog frame boundary.


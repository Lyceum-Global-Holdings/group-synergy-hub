

# Fix: Item list content overflowing dialog frame

## Problem

From the screenshot, the "Select" badges on the right side are rendering **outside** the dialog's border frame. This happens because the Radix `ScrollAreaPrimitive.Viewport` only manages vertical overflow — it doesn't constrain horizontal width, allowing flex content to push beyond the visible boundary.

## Root Cause

In `scroll-area.tsx` line 11, the Viewport has `h-full w-full` but no explicit `overflow-x-hidden`. The Radix viewport uses `overflow: scroll` in the scroll direction but doesn't clip the cross-axis.

## Fix

### File: `src/components/ui/scroll-area.tsx` (line 11)

Add `overflow-x-hidden` to the Viewport so all ScrollAreas clip horizontal overflow:

```tsx
// Before
<ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">

// After  
<ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] !overflow-x-hidden">
```

This is the minimal, correct fix — it ensures the Viewport clips content horizontally while preserving vertical scrolling. The `!` important modifier overrides Radix's inline style.

### Files to modify
- `src/components/ui/scroll-area.tsx` — 1 line change




# Default "Requested By" to Current User

## What This Does

Pre-fills the "Requested By" field with the current logged-in user's name when the Material Request form opens. The field remains editable so users can change or type a different name if needed.

## Changes

### File: `src/components/warehouse/CreateMaterialRequestDialog.tsx`

1. **Import the `useCurrentUserProfile` hook** (already exists in the project)
2. **Pre-fill `requested_by`** with the user's `full_name` when the dialog opens using a `useEffect`
3. **Keep the existing `<Input>` field** -- it already supports typing, so no UI change needed

### Technical Details

```typescript
// Add import
import { useCurrentUserProfile } from "@/hooks/useCurrentUserProfile";

// Inside the component
const { data: userProfile } = useCurrentUserProfile();

// Add useEffect to set default when dialog opens
useEffect(() => {
  if (open && userProfile?.full_name && !requestData.requested_by) {
    setRequestData(prev => ({ ...prev, requested_by: userProfile.full_name }));
  }
}, [open, userProfile]);
```

Also update the `resetForm` function to reset `requested_by` back to the current user's name instead of empty string:

```typescript
requested_by: userProfile?.full_name || "",
```

## Summary

- 1 file modified (`CreateMaterialRequestDialog.tsx`)
- No database changes needed
- The field auto-fills with the logged-in user's name but remains fully editable

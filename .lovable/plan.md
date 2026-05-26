## Problem
Bulk Issue (and individual issue) fails with "Invalid SRN format. Expected SRN-YYYY-NNNNNN". The check is enforced by the DB trigger function `public.validate_srn_number()`, not the frontend. The earlier frontend-only fix doesn't help.

## Fix
Create a migration that replaces `public.validate_srn_number()` to remove the regex format check. Keep the existing behaviors:
- Normalize empty string → NULL.
- Keep per-company uniqueness check across `material_requests`, `material_issue_notes`, `material_return_notes`.

No other DB or app changes. The trigger bindings on the three header tables remain as-is.

## Out of scope
- `generate_srn_number` still produces `SRN-YYYY-NNNNNN` for auto-generated values — unchanged.
- No frontend changes (already updated previously).

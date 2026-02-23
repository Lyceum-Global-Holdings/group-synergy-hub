

# Automated Edge Function Error Log Management System

## What This Does

Creates a centralized error logging and auto-recovery system that:

1. **Captures** every edge function error into a `system_error_logs` database table with full context (function name, error message, request payload, user, status code)
2. **Auto-retries** transient failures (network timeouts, 5xx errors) with exponential backoff before showing the user an error
3. **Surfaces** error trends in a new **System Error Logs** panel inside the existing Audit Logs page, so admins can see which functions are failing and how often
4. **Proposes fixes** by pattern-matching known error signatures (e.g. "Telegram credentials not configured" -> link to Settings, "Access denied" -> check company membership)

---

## Database Changes

### New Table: `system_error_logs`

```sql
CREATE TABLE public.system_error_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id        uuid,
  function_name  text NOT NULL,
  error_message  text NOT NULL,
  error_code     integer,                -- HTTP status code (400, 401, 500, etc.)
  request_context jsonb DEFAULT '{}',    -- sanitized request metadata (no secrets)
  resolution     text,                   -- auto-resolution taken or suggested fix
  status         text NOT NULL DEFAULT 'open',  -- open | auto_resolved | dismissed
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

RLS policies:
- SELECT: authenticated users within their company
- INSERT: authenticated users (app writes on error)
- UPDATE: authenticated users within their company (to dismiss)

Index on `(company_id, created_at DESC)` and `(function_name, created_at DESC)`.

---

## Code Changes

### 1. New utility: `src/lib/edgeFunctionClient.ts`

A wrapper around `supabase.functions.invoke()` that adds:

- **Automatic retry** for 5xx and network errors (up to 2 retries with 1s / 3s delays)
- **Error logging** to `system_error_logs` on final failure
- **Known-error resolution suggestions** returned alongside the error

```typescript
export async function invokeEdgeFunction<T>(
  functionName: string,
  options: { body?: any; companyId?: string }
): Promise<{ data: T | null; error: Error | null; suggestion?: string }>
```

**Retry logic:**
- HTTP 500, 502, 503, 504 -> retry up to 2 times
- HTTP 400, 401, 403 -> do NOT retry (client error, won't change)
- Network/timeout errors -> retry up to 2 times

**Known error pattern matching** (returns a `suggestion` string):
| Error pattern | Suggestion |
|---|---|
| "Telegram credentials not configured" | "Go to Settings > Telegram to configure your bot token and chat ID" |
| "Access denied to this company" | "Your account may not have access to this company. Contact your admin." |
| "Telegram integration is disabled" | "Enable Telegram integration in Settings > Telegram" |
| "Empty request body" | "The report data was empty. Try regenerating the report." |
| "Invalid authentication" / 401 | "Your session may have expired. Please log in again." |

**Error logging** (on final failure):
```typescript
await supabase.from('system_error_logs').insert({
  company_id: options.companyId,
  user_id: user?.id,
  function_name: functionName,
  error_message: error.message,
  error_code: statusCode,
  request_context: { keys: Object.keys(options.body || {}) }, // no values, no secrets
  resolution: suggestion || null,
  status: wasAutoRetried ? 'auto_resolved' : 'open',
});
```

### 2. Migrate callers to use the new wrapper

Update these files to use `invokeEdgeFunction` instead of raw `supabase.functions.invoke`:

| File | Function called |
|---|---|
| `src/components/construction/dialogs/ViewSiteReportDialog.tsx` | `send-telegram-report` |
| `src/hooks/useTelegramSettings.ts` | `test-telegram-connection`, `scheduled-telegram-reports` |
| `src/hooks/useAdminPasswordReset.ts` | `admin-reset-password` |
| `src/hooks/useUsers.ts` | `admin-create-user` |
| `src/hooks/useTwoLevelPoApprovals.ts` | `po-email-approval` |
| `src/pages/PublicSupplierRegistration.tsx` | `public-supplier-registration` |
| `src/hooks/construction/useFloorRooms.ts` | `analyze-floor-plan` |
| `src/pages/procurement/PoEmailApproval.tsx` | `po-email-approval` |
| `src/lib/approvalWorkflow.ts` | `send-approval-notification` |

Each caller gains automatic retry + logging for free. The `suggestion` field can optionally be shown in the toast message to guide users on how to fix the issue themselves.

### 3. New hook: `src/hooks/useSystemErrorLogs.ts`

Fetches error logs for the admin panel:

```typescript
export function useSystemErrorLogs() {
  // Query: last 100 error logs for the company, ordered by created_at DESC
  // Mutation: dismiss (set status = 'dismissed')
  // Computed: errorSummary (count by function_name, count by error_code)
}
```

### 4. Update: `src/pages/management/AuditLogs.tsx`

Replace the empty placeholder with a working error log viewer:

- **Filter bar**: by function name, error code, status (open/auto_resolved/dismissed), date range
- **Error table**: Date | Function | Error | Status Code | Resolution/Suggestion | Status | Actions
  - "Dismiss" button sets status to `dismissed`
  - Rows with `auto_resolved` are shown in green
  - Rows with `open` are shown in amber/red
  - Resolution column shows the suggested fix (clickable if it links to a settings page)
- **Summary cards** at the top: Total errors (24h), Auto-resolved count, Open count, Most-failing function

---

## Files to Create / Edit

| File | Action | Description |
|---|---|---|
| Migration SQL | Create | `system_error_logs` table with RLS |
| `src/lib/edgeFunctionClient.ts` | Create | Retry wrapper + error logger + suggestion engine |
| `src/hooks/useSystemErrorLogs.ts` | Create | Hook to query and manage error logs |
| `src/pages/management/AuditLogs.tsx` | Edit | Wire up real error log viewer UI |
| `src/components/construction/dialogs/ViewSiteReportDialog.tsx` | Edit | Use `invokeEdgeFunction` |
| `src/hooks/useTelegramSettings.ts` | Edit | Use `invokeEdgeFunction` |
| `src/hooks/useAdminPasswordReset.ts` | Edit | Use `invokeEdgeFunction` |
| `src/hooks/useUsers.ts` | Edit | Use `invokeEdgeFunction` |
| `src/hooks/useTwoLevelPoApprovals.ts` | Edit | Use `invokeEdgeFunction` |
| `src/pages/PublicSupplierRegistration.tsx` | Edit | Use `invokeEdgeFunction` |
| `src/hooks/construction/useFloorRooms.ts` | Edit | Use `invokeEdgeFunction` |
| `src/pages/procurement/PoEmailApproval.tsx` | Edit | Use `invokeEdgeFunction` |
| `src/lib/approvalWorkflow.ts` | Edit | Use `invokeEdgeFunction` |

---

## How Auto-Recovery Works

```text
User triggers action (e.g. Send to Telegram)
       |
       v
invokeEdgeFunction("send-telegram-report", { body, companyId })
       |
       v
  [Call edge function]
       |
  Success? -----> Return data
       |
  5xx / Network error?
       |
  Yes --> Retry (up to 2x with backoff)
       |         |
       |    Success on retry? --> Log as "auto_resolved", return data
       |
  Final failure --> Match error pattern --> Generate suggestion
       |
       v
  Log to system_error_logs (status: "open", resolution: suggestion)
       |
       v
  Return { error, suggestion } to caller
       |
       v
  Toast shows: "Failed to send. [Suggestion: Check Telegram settings]"
```

---

## Key Behaviours

- **No secrets logged**: Only request key names are stored, never values
- **Retry only on transient errors**: 4xx errors are not retried since they indicate client-side issues that won't change
- **Non-blocking logging**: The error log insert happens in the background and does not block the error from being returned to the user
- **Backwards compatible**: All existing callers keep working the same way; they just gain retry + logging
- **Admin visibility**: The Audit Logs page becomes a real operational dashboard instead of an empty placeholder


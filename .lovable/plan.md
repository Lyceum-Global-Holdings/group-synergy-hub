

# Fix: Telegram Report Sending Error

## Root Cause

The error logs confirm the request is still sending `bot_token` and `chat_id` instead of `company_id`. This means your browser is running an **older cached version** of the code. The fix from the previous edit is correct in the codebase but hasn't reached your browser yet.

## Immediate Action Required

**Hard-refresh your browser** to load the updated code:
- **Mac**: Cmd + Shift + R
- **Windows/Linux**: Ctrl + Shift + R

If you're using the **published URL** (`group-synergy-hub.lovable.app`), you'll need to **publish** the latest changes first.

## Additional Safeguard (Code Change)

To make the fix more robust and provide better error feedback, I'll add extra logging and validation:

### File: `src/components/construction/dialogs/ViewSiteReportDialog.tsx`

1. Add a `console.log` before the function invoke to confirm the correct payload is being sent (helps verify the right code is running)
2. Improve error handling to show the actual server error message in the toast notification

### Changes

```typescript
// Before invoke call, add debug log
console.log("Sending telegram report with company_id:", selectedCompany.id);

const { data, error } = await supabase.functions.invoke('send-telegram-report', {
  body: {
    pdf_base64: pdfBase64,
    filename: `${displayReport.report_number}.pdf`,
    report_number: displayReport.report_number,
    project_name: displayReport.project?.project_name || 'N/A',
    report_date: formatPeriod(),
    report_type: reportType,
    company_id: selectedCompany.id
  }
});

// Improve error handling to show server message
if (error) {
  const errorMessage = error?.message || 'Unknown error';
  throw new Error(errorMessage);
}

if (data && !data.success) {
  throw new Error(data.results?.map(r => r.error).filter(Boolean).join(', ') || 'Send failed');
}
```

### In the catch block, update toast to show the specific error:

```typescript
toast({
  title: "Failed to send",
  description: error.message || "Could not send report to Telegram.",
  variant: "destructive"
});
```

## Summary

| Change | Purpose |
|--------|---------|
| Hard refresh browser | Load the already-correct code |
| Add console.log before invoke | Verify correct payload is sent |
| Improve error toast | Show actual error message from server |
| Check `data.success` | Handle partial send failures |




## Problem

The force-triggered test returned "No reports today" because:
- Current time: 02:43 UTC = 08:13 IST on **March 7**
- The function calculates "today" as **March 7** in IST
- The report is dated **March 6**
- **The "yesterday fallback" from the approved plan was never implemented**

The March 6 report (`DSR-20260306-001`, company `11a46626...`) exists in the database but won't be found because the query only looks for `report_date = '2026-03-07'`.

## Fix

Add the missing yesterday fallback to `supabase/functions/scheduled-telegram-reports/index.ts`. After the initial query for today's reports returns empty (line 275), query again for yesterday's local date before giving up.

### Changes to `supabase/functions/scheduled-telegram-reports/index.ts`

At line 275-302 (the "no reports" block), insert a fallback query:

```typescript
if (!reports || reports.length === 0) {
  console.log(`No reports found for local date ${todayDateStr}, checking yesterday as fallback...`);
  
  // Calculate yesterday's local date
  const yesterdayLocal = new Date(localTime.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayDateStr = yesterdayLocal.toISOString().split('T')[0];
  
  const { data: yesterdayReports, error: yesterdayError } = await supabase
    .from('daily_site_reports')
    .select(reportSelect)
    .eq('company_id', setting.company_id)
    .eq('report_date', yesterdayDateStr);
  
  if (!yesterdayError && yesterdayReports && yesterdayReports.length > 0) {
    console.log(`Found ${yesterdayReports.length} reports for yesterday (${yesterdayDateStr}), using fallback`);
    reports = yesterdayReports; // Use yesterday's reports instead
  } else {
    // Original "no reports" handling with the 3-hour guard logic
    // ... keep existing code ...
  }
}
```

After implementing, redeploy the function and re-trigger with `{"force": true}` to verify the March 6 report is delivered via Telegram.


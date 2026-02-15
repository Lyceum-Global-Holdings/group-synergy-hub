

# Fix PDF Export Charts and Structure for Location Reports

## Problems Identified

1. **Charts are compressed** -- Canvas renders at 500x250px but squeezed into 85x42mm in PDF, making labels unreadable
2. **Legend text truncated** -- "Maintenance" shows as "Maintenan", location names cut to 10-12 chars
3. **Two charts crammed side-by-side** on the same row (bar + pie at 85mm each)
4. **Status chart only shows one color** when most assets share one status, making the stacked bars misleading
5. **Data is artificially capped** -- summary table limited to 15 rows, detail breakdowns to 10 locations, asset master items to 10 per location

## Solution

Rewrite the PDF layout in `src/utils/locationReportPdfExport.ts` to produce a clean, structured, professional report.

## Changes

### File: `src/utils/locationReportPdfExport.ts`

**1. Increase chart canvas sizes and give each chart a full-width row:**

- Bar chart: render at 800x400 canvas, place full-width (180mm wide, ~60mm tall) on its own section
- Pie chart: render at 600x400 canvas, place centered (~120mm wide, ~70mm tall) below the bar chart
- Status chart: render at 800x400 canvas, place full-width on a new page

**2. Fix legend and label truncation:**

- Increase label character limits from 10-12 to 18-20 characters
- Increase legend label limits from 12 to 18 characters
- Adjust legend layout to use 3 columns instead of 4 for more space
- Fix pie chart legend positioning to avoid overlap

**3. Remove artificial data caps:**

- Summary table: remove `.slice(0, 15)` -- show all locations
- Detail breakdowns: remove `.slice(0, 10)` -- iterate all locations
- Subcategory table: remove `.slice(0, 8)` limit per location
- Asset master table: remove `.slice(0, 10)` limit per location
- Increase asset name truncation from 20 to 30 chars

**4. Restructure PDF page flow:**

```
Page 1: Header, KPI Summary, Asset Count Bar Chart
Page 2: Value Distribution Pie Chart, Status Stacked Bar Chart
Page 3+: Summary Table (all locations)
Remaining: Detailed breakdowns per location (with proper page breaks)
Footer: Page numbers on every page
```

**5. Add proper page-break logic before each chart:**

- Check remaining space before rendering each chart
- Add page break if insufficient space (less than chart height + margin)

### Specific Code Changes

**drawBarChart (line 84):** Increase bottom padding from 60 to 80, increase label text from 9px to 10px, increase truncation from 10 to 18 chars

**drawPieChart (line 162):** Move legend higher, increase legend label from 12 to 18 chars, use 3 columns instead of 4, increase font from 9px to 10px

**drawStackedBarChart (line 249):** Increase bottom padding from 80 to 100, increase label from 10 to 18 chars, increase legend spacing from 60 to 80px

**drawSubcategoryConditionChart (line 339):** Same label length increases

**exportLocationReportPdf (line 475):**
- Place bar chart full-width: `doc.addImage(img, "PNG", margin, currentY, 180, 60)`
- Add page break, place pie chart centered: `doc.addImage(img, "PNG", 30, currentY, 150, 70)`
- Add page break, place status chart full-width: `doc.addImage(img, "PNG", margin, currentY, 180, 60)`
- Remove all `.slice()` limits on data output
- Add `if (currentY > pageHeight - chartHeight) { doc.addPage(); currentY = 20; }` before each chart

## Summary

- One file modified: `src/utils/locationReportPdfExport.ts`
- Charts given full-width placement with proper spacing
- Labels and legends no longer truncated
- All data included without artificial caps
- Professional page flow with proper page breaks


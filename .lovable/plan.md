

# Add Native jsPDF-Drawn Charts to PDF Export

## Problem
The previous fix replaced stretched canvas-rendered chart images with plain tables. While this fixed the distortion, the user wants actual visual charts in the PDF alongside (or instead of) the tables.

## Solution
Draw charts natively using jsPDF drawing primitives (rectangles, lines, arcs, text). These render at full PDF resolution with no stretching since they are vector-based, not image-based.

## File: `src/utils/locationReportPdfExport.ts`

### 1. Add a native horizontal bar chart for "Assets by Location"
- Draw colored horizontal bars proportional to asset count
- Label each bar with location name and count
- Uses `doc.setFillColor()` + `doc.rect()` for bars and `doc.text()` for labels
- Keep the existing table below the chart for detailed numbers

### 2. Add a native pie chart for "Value Distribution"
- Draw colored arc segments using jsPDF path drawing or filled wedges
- Add a legend beside the chart with color swatches and labels
- Keep the existing table below for exact values

### 3. Add a native stacked horizontal bar chart for "Status by Location"
- Draw stacked colored segments (green=Active, yellow=Maintenance, red=Inactive)
- Label each row with the location name
- Add a color legend
- Keep the existing table below

### 4. Helper drawing functions to add
- `drawHorizontalBarChart(doc, data, x, y, width, height, color)` - draws a simple horizontal bar chart
- `drawPieChartNative(doc, data, cx, cy, radius)` - draws pie segments using trigonometry + `doc.triangle()`/`doc.lines()`
- `drawStackedBarChartNative(doc, data, x, y, width, height)` - draws stacked horizontal bars

### Layout adjustments
- Charts will be placed above their corresponding tables
- Each chart takes approximately 60-80mm of vertical space
- Page break logic will be adjusted to accommodate charts + tables
- If content overflows page 1, it flows naturally to page 2

## Technical approach
- jsPDF supports `doc.rect(x, y, w, h, 'F')` for filled rectangles (bars)
- For pie chart: calculate angles from data percentages, draw filled triangular wedges from center using `doc.lines()` with fill
- Colors: use a predefined palette array for consistent chart coloring
- All drawing is vector-based, so it scales perfectly at any zoom level

## Result
- PDF will contain professional-looking charts AND detailed tables
- No image stretching since everything is drawn natively in PDF
- Charts use location codes where available (already handled by data passed in)

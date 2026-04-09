
I’ll fix this by changing the diagram-generation approach rather than just re-exporting the same diagrams at a higher resolution.

## Best solution

The Mermaid diagrams are most likely unclear because of a combination of:
1. too much content per diagram,
2. raster PNG export being scaled down in the PDF,
3. labels/edges being too dense for the page width,
4. inconsistent layout direction for process maps.

The best standards-based solution is to rebuild the asset document diagrams as executive process maps with one process per page/section, simplified node counts, consistent notation, and print-safe export settings.

## What I will change

### 1. Redesign all Mermaid diagrams for readability
I’ll replace dense technical diagrams with cleaner BPMN-style Mermaid flowcharts:
- 1 process = 1 focused diagram
- 6–10 nodes per diagram where possible
- top-to-bottom flow for approvals/lifecycles
- left-to-right flow for integrations/data movement
- explicit start/end nodes
- short labels only

Examples:
- Asset lifecycle
- Asset master to physical asset sync
- Asset registration
- Asset transfer
- Asset request approval
- Depreciation calculation
- Finance integration
- QR/public scan flow
- Reporting pipeline
- Security/RLS access model

### 2. Split complex diagrams into sub-diagrams
Instead of one crowded diagram, I’ll separate them into:
- business workflow diagram
- system/data flow diagram
- state/lifecycle diagram

Example:
- “Asset Requests” becomes:
  - Request approval workflow
  - Purchase-to-fulfillment workflow
- “Depreciation” becomes:
  - Calculation logic
  - Posting/integration to finance

### 3. Use print-safe Mermaid conventions
I’ll regenerate diagrams using:
- larger base font sizes
- larger node spacing
- wrapped labels avoided
- plain rectangular nodes for process steps
- decision diamonds only where necessary
- no oversized relationship webs

### 4. Change PDF embedding strategy
I’ll update the document generator so diagrams are inserted with:
- larger on-page width
- preserved aspect ratio
- dedicated spacing before/after figure
- optional full-width figure pages for the most important maps

For the densest diagrams, I’ll use a full-page diagram layout instead of squeezing them inside text-heavy pages.

### 5. Add diagram captions and process context
Each diagram section will include:
- purpose
- trigger
- inputs
- outputs
- related screens/tables

This reduces the need to overload the diagram itself with explanatory text.

## Files/artifacts to update

### Generated artifacts
- `/mnt/documents/NCG_Warehouse_Asset_Management_Documentation_v2.pdf`
- `/mnt/documents/asset-management-diagrams/*.mmd`

### Generation logic
- regenerate the asset documentation script used for the current PDF
- replace the existing Mermaid definitions with simplified, standards-aligned versions
- update image sizing/layout rules in the PDF builder

## Technical details

### Diagram design standard
I’ll follow a hybrid of:
- ISO 55001 asset lifecycle structure
- BPMN-style process clarity
- SAP-style operational flow sequencing

### Rendering improvements
I’ll use:
- higher-resolution export
- larger canvas dimensions
- more whitespace around nodes
- fewer cross-links
- per-diagram layout direction chosen for readability

### Why this is better than just “higher resolution”
If the diagram structure is too dense, HD export only makes a crowded diagram sharper, not clearer. The real fix is:
```text
simplify structure
-> separate concerns
-> enlarge placement in PDF
-> export cleanly
```

## Expected result
The revised PDF will have diagrams that are:
- readable at normal zoom
- understandable by operations and management users
- aligned with international documentation practice
- visually consistent across the whole asset management document

## QA I will perform after implementation
- inspect every diagram page visually after PDF generation
- verify no clipped labels or overlapping nodes
- confirm text remains readable at standard page view
- check ordering and captions for every process map
- keep the old PDF intact and deliver a versioned replacement

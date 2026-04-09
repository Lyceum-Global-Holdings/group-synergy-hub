

## Generate: NCG Warehouse Solutions — Asset Management Sub-Document

### Output
PDF: `/mnt/documents/NCG_Warehouse_Asset_Management_Documentation.pdf`
Mermaid process diagrams embedded as rendered PNG images.

### Scope
A standalone sub-document covering **all asset management features** found in the codebase, aligned with ISO 55001 (Asset Management), IAS 16 (Property, Plant & Equipment), and SAP EAM standards.

### Document Structure (~40-50 pages, dense technical content)

**1. Introduction & Standards Alignment (~3 pages)**
- Purpose and scope as NCG Warehouse Solutions sub-document
- ISO 55001, IAS 16, IFRS 16 compliance mapping
- Asset management lifecycle overview
- Mermaid: **Asset Management Lifecycle** (Plan → Acquire → Operate → Maintain → Dispose)

**2. Asset Master (Template Management) (~5 pages)**
- Creating asset master templates (name, brand, category, depreciation config)
- Purchase history tracking per template
- Inventory count linkage (master → physical assets)
- Master-to-inventory sync logic (updates propagate to all linked warehouse_assets)
- Field reference table (all 20+ fields)
- Mermaid: **Asset Master to Inventory Sync Flow**

**3. Physical Asset Registry (~6 pages)**
- Asset creation (single and bulk, up to 100 per batch)
- Auto-fill from Asset Master selection
- Asset identification: asset_id, serial_number, asset_tag
- Status lifecycle: Active → Maintenance → Inactive → Disposed
- Condition tracking: Good, Fair, Poor, Needs Repair
- Multi-company/multi-location scoping via junction table
- Batch-fetching and client-side pagination (50 rows, 1000-batch server fetch)
- Field reference table
- Mermaid: **Asset Registration Workflow**, **Asset Status Lifecycle**

**4. Category & Classification (~4 pages)**
- ISO 7372 / UNSPSC category codes (3-letter mnemonics)
- Hierarchical categories with parent-child codes (ELC-CMP)
- Category management dialog (create, edit, delete)
- Standard category import (12 industry templates)
- Role-based category management (admin only for delete)

**5. Location & Spatial Management (~4 pages)**
- 3-tier hierarchy: Location → Sub-location → Department
- Location-company mapping via junction table
- Asset assignment to location hierarchy
- Mermaid: **Location Hierarchy & Asset Assignment**

**6. Asset Transfers (~4 pages)**
- Transfer workflow (from/to location, sub-location, department)
- Transfer history and audit trail
- Public asset transfer via QR scan (authenticated redirect)
- Mermaid: **Asset Transfer Workflow**

**7. Depreciation & Valuation (~6 pages)**
- Straight-line depreciation (useful life method)
- Declining balance depreciation (rate method)
- Depreciation calculator logic (accumulated, annual, monthly, remaining life)
- Finance module integration: Run Depreciation dialog, depreciation_schedule, asset_transactions
- GL auto-posting from depreciation runs
- Journal entry linkage
- IAS 16 compliance (cost model, revaluation model)
- Mermaid: **Depreciation Calculation Flow**, **Finance-Warehouse Depreciation Integration**

**8. Asset Requests & Procurement Workflow (~5 pages)**
- Request creation with line items (new purchase, from stock, transfer)
- Multi-stage approval: Draft → HOD Approval → Procurement → Purchase → Fulfillment
- Workflow history tracking
- Priority and cost estimation
- Quantity management (requested, approved, fulfilled)
- Mermaid: **Asset Request Approval Workflow**

**9. QR Code & Public Access (~3 pages)**
- Individual QR code generation per asset
- Bulk QR code PDF generation (2x1 inch labels)
- Public asset view via RPC (get_public_asset)
- Unauthenticated viewing, authenticated transfers
- Mermaid: **QR Code Scan & Public Access Flow**

**10. Analytics & Reporting (~4 pages)**
- Unified Analytics Dashboard (Overview, Category, Location sub-tabs)
- KPIs: total count, active count, maintenance count, total value
- 5 Excel report types (location, sub-location, department, category, subcategory)
- Asset location reports with depreciation data
- Mermaid: **Report Generation Pipeline**

**11. Bulk Operations (~3 pages)**
- Bulk import via CSV/dialog
- Bulk update (location, status, condition)
- Bulk delete (admin permission required)
- Selection management and validation

**12. Security & Access Control (~3 pages)**
- RLS policies (company-scoped isolation)
- Role-based permissions (admin delete, standard CRUD)
- SECURITY DEFINER functions for cross-tenant operations
- Audit trail (created_by, timestamps)

### Mermaid Diagrams (~12 total)
1. Asset Management Lifecycle
2. Asset Master to Inventory Sync
3. Asset Registration Workflow
4. Asset Status Lifecycle (state machine)
5. Location Hierarchy & Assignment
6. Asset Transfer Workflow
7. Depreciation Calculation Flow
8. Finance-Warehouse Depreciation Integration
9. Asset Request Approval Workflow
10. QR Code Scan & Public Access
11. Report Generation Pipeline
12. RLS Security Model

### Visual Design
- Navy (#1E2761) and Gold (#C9A84C) branding (matching main documentation)
- "NCG Warehouse Solutions" sub-document branding
- Cover page with classification, audience, edition fields
- Gray callout boxes, field reference tables, step-by-step procedures

### Technical Execution
1. Generate 12 Mermaid `.mmd` files → render to PNG via `mmdc`
2. Build PDF with ReportLab Platypus
3. QA: convert to images, inspect sample pages


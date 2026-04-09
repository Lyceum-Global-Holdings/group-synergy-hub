

## Generate: TUH Complete Documentation — Production, BOM, Material Demand Planning & Finished Goods

### Output
`/mnt/documents/TUH_Complete_Module_Documentation.docx` — 80+ page professionally formatted Word document with embedded Mermaid process diagrams, aligned with international standards (ISO 22400, ISO 55001, APICS/ASCM MRP-II, IAS 2).

### Document Structure (15 Chapters + Appendices)

| # | Chapter | Est. Pages | Diagrams |
|---|---------|-----------|----------|
| 1 | Executive Summary & System Overview | 3 | 1 (end-to-end flow) |
| 2 | International Standards Alignment | 4 | 1 (standards mapping) |
| 3 | Product Master Management | 5 | 1 (product lifecycle) |
| 4 | Bill of Materials (BOM) — Core | 8 | 2 (BOM creation flow, BOM explosion) |
| 5 | BOM Versioning & Templates | 5 | 1 (version control flow) |
| 6 | BOM Size Multipliers & Substitutions | 4 | 1 (size scaling flow) |
| 7 | BOM Approval Workflow | 4 | 1 (approval state machine) |
| 8 | Production Module — Sectors & Stages | 6 | 2 (sector setup, stage pipeline) |
| 9 | Production Orders & WIP Tracking | 8 | 2 (order lifecycle, daily entry flow) |
| 10 | Stage-wise Cost Management | 5 | 1 (cost accumulation) |
| 11 | Material Demand Planning (MDP/MRP) | 8 | 2 (MRP netting logic, demand-to-PO flow) |
| 12 | CPO-Driven Demand Calculation | 6 | 2 (CPO-to-demand flow, BOM explosion for CPO) |
| 13 | Finished Goods Management | 7 | 2 (FG lifecycle, production receipt flow) |
| 14 | Demand Overview & Sales Fulfillment | 5 | 1 (production-to-fulfillment pipeline) |
| 15 | Finished Goods Valuation & Batch Management | 4 | 1 (batch traceability) |
| A | Appendix A: Field Reference Tables | 4 | — |
| B | Appendix B: Status Lifecycle Tables | 3 | — |
| C | Appendix C: Phased Implementation Roadmap | 4 | 1 (Gantt-style phases) |
| D | Appendix D: Glossary & Acronyms | 2 | — |

**Total: ~87 pages, 22 Mermaid diagrams**

### Phased Implementation (included in Appendix C)

- **Phase 1 — Foundation**: Product Master setup, BOM creation, sector/stage initialization
- **Phase 2 — Production**: Production order creation, WIP tracking, daily entries, stage costs
- **Phase 3 — MRP**: Material demand calculation from BOMs, POs, and CPOs; shortage analysis; auto-PR generation
- **Phase 4 — Finished Goods**: Production receipts, batch management, valuation, demand overview
- **Phase 5 — Optimization**: BOM templates, substitutions, size multipliers, approval workflows, advanced MRP netting

### International Standards Coverage

| Standard | Application |
|----------|------------|
| APICS/ASCM MRP-II | MRP netting logic (gross → net requirements), safety stock, lead time offsetting |
| ISO 22400 | Production KPIs: OEE, throughput, WIP value, stage efficiency |
| IAS 2 / IFRS | Finished goods valuation (weighted average cost, standard cost) |
| ISO 9001 | Quality control at production stages, batch traceability |
| GS1 Standards | Product coding, batch/lot identification |

### Diagram Rendering Approach
- Generate simplified, clear Mermaid `.mmd` files (max 15 nodes per diagram)
- Render at 2000px width using `mmdc` with white background
- Embed in DOCX with aspect-ratio-preserving scaling (max 560px wide, max 680px tall)
- Read actual PNG dimensions from IHDR chunk to prevent stretching

### Visual Design
- Navy (#1E2761) and Gold (#C9A84C) branding consistent with existing documentation
- Static TOC with internal bookmarks and dot leaders
- Gray callout boxes for key concepts
- Field reference tables with navy header rows
- Step-by-step numbered procedures

### Technical Execution
1. Generate 22 Mermaid `.mmd` files in `/tmp/tuh_diagrams/`
2. Render all to PNG via `mmdc`
3. Build DOCX with `docx-js` using chapter registry pattern
4. Embed diagrams with dynamic aspect-ratio scaling
5. Generate static TOC with bookmarks
6. QA: Convert to PDF via LibreOffice, render to images, inspect sample pages


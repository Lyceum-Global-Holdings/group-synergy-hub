

## Update: Add Process Maps to System Manual (v2)

### What's Missing
The current 53-page manual describes each module in prose but contains no visual process flow diagrams. The GarageOne reference manual includes process maps for every major workflow. We need to add these.

### Process Maps to Add (11 diagrams)

Each process map will be a visual flowchart rendered directly in the PDF using ReportLab's drawing primitives (boxes, arrows, diamonds for decisions, color-coded by stage).

1. **Procurement Lifecycle** -- PR (Draft → Submitted → Approved) → PO (Draft → Pending Approval → Dept Head Approval → Approved → Sent → Acknowledged → Partially Received → Completed) → GRN → 3-Way Match → Payment
2. **Warehouse Operations** -- Item Master → Bin Allocation → GRN Receipt → Quality Check → Put-Away → FIFO Stock Transfer → Stock Issue → Cycle Count
3. **Supplier Management** -- Registration → Evaluation → Onboarding → Scorecard → Performance Review → Blacklist/Suspend decision
4. **Production** -- BOM Creation → Production Order → Material Issue → Manufacturing → Quality Inspection → Production Receipt → Finished Goods
5. **Construction Project** -- Project Setup → Site Activation → Work Orders → Daily Reports (Draft → Submitted → Approved) → Phase Completion → Project Closeout
6. **Sales / Customer PO** -- Customer PO → Pick → Pack → Dispatch → Delivery Order → Invoice
7. **Accounts Payable** -- Vendor Invoice → 3-Way Match (PO + GRN + Invoice) → Approval → Payment → Bank Reconciliation
8. **Accounts Receivable** -- Sales Invoice → Customer Payment → Receipt Matching → Aging → Write-off/Collection
9. **Fixed Asset Lifecycle** -- Asset Request → Approval → Acquisition → Depreciation → Revaluation → Disposal
10. **Approval Workflow** -- Request Created → Pending → Stage 1 Approval → Stage N Approval → Approved/Rejected → Escalation path
11. **RFQ/RFP Process** -- Draft → Published → Supplier Invitations → Quote Submission → Evaluation → Award

### Design Approach
- Each process map is a full-page landscape-oriented diagram with color-coded boxes (blue for start/end, green for actions, amber for decisions, red for rejection paths)
- Arrow connectors between stages with labels
- Rendered using ReportLab `Drawing` / `shapes` primitives (no external image dependencies)
- Process maps inserted into the Module Architecture Reference section (pages 10-20), one per module, immediately after each module's summary page

### Output
- New file: `GroupSynergyHub_SystemManual_v2.pdf` (~65-70 pages)
- Same content + 11 new process map pages interleaved in the module reference section

### Technical Approach
1. Regenerate the full PDF script with the existing content preserved
2. Add a `draw_process_map(canvas, title, steps, decisions)` helper function
3. Each process map page uses landscape orientation with the branded header/footer
4. Visual QA on every process map page after generation

### Files
- Script: `/tmp/gen_manual_v2.py` (regenerated)
- Output: `/mnt/documents/GroupSynergyHub_SystemManual_v2.pdf`


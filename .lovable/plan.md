### Rename "Job Number" to "Gate Pass No" in MIN workflow

The selected "Job Number" label in `CreateMaterialIssueDialog.tsx` will be renamed to "Gate Pass No". The underlying data stays in the existing `job_number` DB column; only UI labels and the PDF display label change.

#### Changes
1. **`src/components/warehouse/CreateMaterialIssueDialog.tsx`**  
   - Change the `<Label>` text from `"Job Number"` to `"Gate Pass No"` (line ~502).  
   - Update the input placeholder from `"Job/Project reference"` to `"Gate pass / reference number"`.

2. **`src/utils/materialIssuePdfExport.ts`**  
   - Change the PDF field label from `"Job Number"` to `"Gate Pass No"` in the issue-details grid (line ~132), so it reads correctly when the MIN is downloaded.

No database migration is needed because the `job_number` column already exists and is already being saved and rendered in the PDF.

#### Verification
- Open Create Material Issue dialog → confirm the field now reads "Gate Pass No".  
- Create or open an existing MIN with a value in that field, click Download PDF → confirm the PDF header grid shows "Gate Pass No" and the value.
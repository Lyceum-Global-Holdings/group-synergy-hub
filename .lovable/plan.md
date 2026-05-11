# Simplify Bin QR Label Text

Update the printed/downloaded bin QR label so the text block next to the QR shows only three lines:

1. **Item Code** (bold, monospace)
2. **Item Name**
3. **Bin**

Remove the **Location** and **Qty** lines from the label. The QR payload (GS1 Digital Link with item/bin/location codes) is unchanged — only the human-readable text block is trimmed.

## File to change

- `src/utils/bulkBinQRCodePdf.ts` — remove the `Loc:` and `Qty:` `doc.text(...)` calls; rebalance vertical spacing of the remaining three lines so they sit nicely centered next to the 0.9" QR.

## Out of scope

- QR payload contents (still encodes item/bin/location codes per GS1).
- Other QR generators (`bulkQRCodePdf.ts`, `bulkQRCodePng.ts`, `printQRCodeLabels.ts`) — only the bin allocation label was requested.
- Label dimensions (still 2"×1" landscape).

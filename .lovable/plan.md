Plan:

1. Update the single bin QR download flow in `BinAllocationQRDialog`.
   - Replace the current QR-only PNG download with a generated label image.
   - The downloaded image will show the QR code with only these fields next to it:
     - Item code
     - Item name
     - Bin name/code

2. Keep the on-screen dialog preview unchanged unless needed for consistency.
   - The QR payload stays the same.
   - No location or quantity will be added to the downloaded label text.

3. Match the existing bulk label format.
   - Use a 2" × 1" landscape label layout.
   - QR on the left, required item/bin text on the right.
   - Ensure the PNG download is the label, not just the QR matrix.


## Fix Mermaid Diagram Stretching in Asset Management DOCX

### Root Cause
The `diagram()` function in `/tmp/gen_asset_docx.js` hardcodes `transformation: { width: 600, height: 400 }` for every image. But the actual diagrams have wildly different aspect ratios:

| Diagram | Actual Size | Aspect | Current Display | Result |
|---------|------------|--------|-----------------|--------|
| d1.png | 3050×346 | 8.82 | 600×400 | Squished vertically |
| d10.png | 726×2106 | 0.34 | 600×400 | Stretched horizontally |
| d14.png | 820×2528 | 0.32 | 600×400 | Stretched horizontally |
| d8.png | 1632×922 | 1.77 | 600×400 | Slightly distorted |

### Fix
Replace the fixed-size `diagram()` function with one that:
1. Reads each PNG's actual dimensions using `sizeOf` (from `image-size` npm package) or raw buffer parsing
2. Calculates display size preserving aspect ratio
3. Constrains to max width 580px and max height 700px (fits within US Letter margins)
4. For very tall diagrams (aspect < 0.5), caps height and scales width proportionally
5. For very wide diagrams (aspect > 3), caps width and scales height proportionally

### Updated `diagram()` function logic
```javascript
function diagram(num, caption) {
  const fp = path.join(DIAG_DIR, `d${num}.png`);
  if (!fs.existsSync(fp)) return [p(`[Diagram ${num} not available]`)];
  const buf = fs.readFileSync(fp);
  // Read PNG dimensions from header (bytes 16-23)
  const pngW = buf.readUInt32BE(16);
  const pngH = buf.readUInt32BE(20);
  const aspect = pngW / pngH;
  const MAX_W = 580, MAX_H = 700;
  let w, h;
  if (aspect >= 1) {
    w = Math.min(MAX_W, pngW);
    h = Math.round(w / aspect);
    if (h > MAX_H) { h = MAX_H; w = Math.round(h * aspect); }
  } else {
    h = Math.min(MAX_H, pngH);
    w = Math.round(h * aspect);
    if (w > MAX_W) { w = MAX_W; h = Math.round(w / aspect); }
  }
  // ... embed with transformation: { width: w, height: h }
}
```

### Steps
1. Update the `diagram()` function in `/tmp/gen_asset_docx.js` to read actual PNG dimensions and preserve aspect ratio
2. Regenerate the DOCX
3. QA: Convert to PDF, then to images, inspect diagram pages

### Output
Overwrite `/mnt/documents/NCG_Warehouse_Asset_Management_Documentation.docx`


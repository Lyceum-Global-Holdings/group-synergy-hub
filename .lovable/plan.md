
## Fix plan: make the TOC real inside the DOCX

### What I found
- The current output does have a TOC page, but it only shows the heading “Table of Contents” with no entries.
- That means the document is relying on a dynamic Word/LibreOffice TOC field that is not being materialized into visible content in the saved DOCX.
- A field-based TOC is not reliable enough here for a deliverable document.

### Best fix
I will stop relying on an auto-updating field as the primary TOC and instead generate a visible TOC section directly in the DOCX content.

### Implementation approach
1. **Replace the current empty TOC approach**
   - Remove the dependency on a field-only TOC as the main solution.
   - Generate a real TOC page in the document body so entries are always visible.

2. **Create a single chapter registry**
   - Define every chapter/subchapter once in a structured list:
     - title
     - level
     - bookmark id
     - content builder
   - Use this same registry for both headings and TOC entries so nothing goes out of sync.

3. **Add proper internal navigation**
   - Attach bookmarks to all chapter headings.
   - Build clickable TOC entries using internal hyperlinks.
   - Format entries with indentation by heading level and dot leaders for a professional Word layout.

4. **Make page numbers reliable**
   - Use a **two-pass generation flow**:
     - Pass 1: generate the document content with headings/bookmarks
     - Pass 2: determine actual chapter start pages from rendered output
     - Rebuild/patch the DOCX with a static TOC that includes visible page numbers
   - This avoids depending on Word to calculate the TOC after delivery.

5. **Preserve existing document quality**
   - Keep the current Navy/Gold styling, headings, footer, and diagram fixes.
   - Ensure TOC formatting matches the rest of the manual.

### Technical details
- DOCX TOC fields are not enough on their own because page numbers are resolved by a layout engine, not by `docx-js`.
- The robust solution is a **static generated TOC** with:
  - real text entries
  - internal hyperlinks
  - explicit page numbers
  - Heading 1 / Heading 2 structure kept for consistency
- I will keep headings as true `HeadingLevel` paragraphs and add bookmarks so navigation still works cleanly.

### QA
I will verify:
- TOC entries are visibly present in the DOCX itself
- each TOC line links to the correct section
- page numbers match the rendered document
- no blank TOC page remains
- formatting is aligned and readable in Word/LibreOffice

### Output
- Update the same file: `NCG_Warehouse_Asset_Management_Documentation.docx`
- Keep the PDF aligned after regeneration so both versions match

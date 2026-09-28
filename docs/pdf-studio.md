# PDF Studio

The editor retains the existing Shift Hours colours, theme classes and PT/EN/ES interface. It runs locally in the browser: uploaded PDF/image bytes are not sent to a server. The existing `feature/free-plan-job-limit` branch and Vercel configuration are unchanged.

## Editing model

PDFium (pinned MIT-licensed `@embedpdf/pdfium` 2.15.1, with its bundled PDFium notices in `public/licenses/`) identifies visible text objects, including nested Form XObjects. Adjacent fragments with matching appearance and baseline are grouped for selection. The source bytes remain immutable.

Only changed/deleted objects are removed. Recursive text-only removal preserves images, paths and page backgrounds. After saving and reopening the intermediate PDF, the editor compares every other recognized text string and its position with the original. If the original was not removed, or another recognized text was affected, export fails rather than masking the issue. This also prevents accidental edits to shared form instances that affect other occurrences.

pdf-lib writes the replacement text and AcroForm values in a dedicated worker. PDF.js renders a background with the active object removed; an immediate SVG/textarea layer handles typing, dragging and formatting without regenerating the document. It uses the same standard-font metrics and wrapping as export; browser glyph appearance can vary slightly while editing. Once deselected, the object is rendered from the generated PDF. Download always generates a complete, validated file from the latest state. Selecting text alone does not rewrite the exported file. Text can be moved, scaled, rotated, reformatted, deleted, restored, undone and redone. New PNG/JPEG images and drawn signature images use the same page-coordinate model.

## Interaction

- Add text, then click the page: the caret appears at that position immediately.
- Double-click recognized text (or select it and press Enter) to edit in place.
- Drag text or its border to move it; drag the corner to resize it.
- Ctrl/Cmd+B and I format the selected block. Escape leaves typing mode; arrows nudge the selected object (Shift moves 10 points). Delete removes it when not typing.
- Ctrl/Cmd+Z and Shift+Z undo/redo; typing is grouped into one undo operation per focus session.
- The native PDF engine runs in a Web Worker. Changes to the active object do not trigger page reconstruction; other page changes and final export still take processing time.

## Limits

- This is block editing, not a word processor with document-wide paragraph reflow. Width wraps text within a block; it does not move neighbouring content.
- Changed text uses the selected Helvetica, Times or Courier family and supported Latin characters. Embedded subset fonts cannot reliably provide arbitrary new characters. Unsupported characters cause a visible export error, not silent omission.
- Scans, outlined/vector letters, invisible/clipping text and some complex overlapping content cannot be edited as text. There is no OCR. Overlap validation is deliberately conservative.
- PDFium may rewrite the edited page's content streams. This is not a forensic redaction/sanitization product. Retained metadata, attachments and previous digital signatures are outside this workflow.
- Existing text, checkboxes, radio buttons and choice AcroForm widgets are recognized and remain interactive. Read-only/unsupported widget types remain unavailable for editing. XFA and PDF JavaScript calculations are not executed.
- Drawn signatures are ordinary images, not cryptographic digital signatures. Editing a previously signed PDF does not preserve the validity of its signature.
- PDF input is limited to 25 MB / 100 pages; images to 10 MB. Complex files can still be slow while the browser regenerates the PDF.

## Verification

```sh
npm ci
npm run lint
npm run test:pdf
npm run build
npx playwright install --with-deps chromium
npm run test:pdf:ui
```

The browser suite runs from the development-only `/tests/pdf-studio.html` harness, bypassing Firebase authentication only in that harness. Vite's production build has only the normal `index.html` entry and does not publish the harness. CI uses synthetic PDFs, never uploaded customer documents.

An optional private reference check can be run locally:

```sh
PDF_REFERENCE=/absolute/path/to/reference.pdf PDF_REFERENCE_TEXT='text to replace' npm run test:pdf
```

The optional check assumes an unrotated reference PDF and writes its result to `/tmp/shifthours-reference-edited.pdf`. Do not commit the reference or output. The production editor handles page rotation and crop boxes separately, covered by synthetic regression tests.

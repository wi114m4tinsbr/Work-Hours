# PDF Studio

The editor retains the existing Shift Hours colours, theme classes and PT/EN/ES interface. It runs locally in the browser: uploaded PDF/image bytes are not sent to a server. The existing `feature/free-plan-job-limit` branch and Vercel configuration are unchanged.

## Editing model

PDFium (pinned MIT-licensed `@embedpdf/pdfium` 2.15.1, with its bundled PDFium notices in `public/licenses/`) identifies visible text objects, including nested Form XObjects. Adjacent fragments with matching appearance and baseline are grouped for selection. The source bytes remain immutable.

Only changed/deleted objects are removed. Page-level text is removed by object identity, so tightly spaced fragments and overlapping page text can be edited independently. Nested form text uses recursive text-only removal, preserving images, paths and page backgrounds. After saving and reopening the intermediate PDF, the editor compares every other recognized text string (ignoring PDFium-generated boundary spaces) and its position with the original. If the original was not removed, or another recognized text was affected, export fails rather than masking the issue. This also prevents accidental edits to shared form instances that affect other occurrences.

pdf-lib writes the replacement text and AcroForm values in a dedicated worker. PDF.js renders a background with the active object removed; an immediate SVG/textarea layer handles typing, dragging and formatting without regenerating the document. It uses the same font metrics and wrapping as export; browser glyph appearance can vary slightly while editing. Once deselected, the object is rendered from the generated PDF. Download always generates a complete, validated file from the latest state. Selecting text alone does not rewrite the exported file. Text can be moved, reflowed to a different width, rotated, reformatted, deleted, restored, undone and redone. New PNG/JPEG images and drawn signature images use the same page-coordinate model.

## Interaction

- Add text, then click the page: the caret appears at that position immediately.
- Click recognized text (or select it and press Enter) to edit in place.
- Drag the border or Move handle to move text. Drag its right edge or corner to change wrapping width without changing font size. Image corners resize proportionally.
- Ctrl/Cmd+B and I format the selected block. Escape leaves typing mode; arrows nudge the selected object (Shift moves 10 points). Delete removes it when not typing.
- Ctrl/Cmd+Z and Shift+Z undo/redo; typing is grouped into one undo operation per focus session.
- The native PDF engine runs in a Web Worker. Changes to the active object do not trigger page reconstruction; other page changes and final export still take processing time.

## Limits

- This is block editing, not a word processor with document-wide paragraph reflow. Width wraps text within a block; it does not move neighbouring content.
- Changed text uses a compatible original/uploaded font or an explicitly selected Helvetica, Times or Courier alternative. Embedded subset fonts cannot reliably provide arbitrary new characters. Unsupported characters cause a visible export error, not silent omission.
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

## Fonts and pinned toolbar

The toolbar stays below the app header while scrolling the PDF. Its main icon row is 48 px tall; a 44 px formatting row appears only for the selected object. Narrow screens scroll tools horizontally while keeping More and Download reachable. More opens a dismissible, scrollable panel for width, rotation, original-font details, font loading and help; instructions and status no longer consume permanent document space. Source font names are retained per text object, and the font inventory lists the fonts detected throughout the document (a PDF may use several fonts). The editing font is shown separately from the original.

Compatible embedded TrueType/OpenType fonts are extracted locally, checked with fontkit and loaded into the browser for editing. Export embeds the same face. Glyph outlines are checked, not only cmap entries: some subsets retain mappings to missing glyphs. Missing characters/styles fail explicitly; they are never silently emitted as missing-glyph boxes. Unsupported embedded formats remain identifiable but require a compatible complete font or an explicit substitute.

Lato, Ubuntu, PT Sans and PT Serif can download automatically from a pinned Google Fonts repository revision. Only allowlisted font URLs are requested; no PDF contents are sent. Downloads time out after five seconds, with local embedded/fallback choices still available. Other fonts, including commercial Calibri/Arial, are not downloaded from guessed sources. A local TTF/OTF can be loaded and reused for typing/export. This does not install fonts on the computer. Variable fonts currently use their default instance; unavailable style variants must be loaded separately.

Explicit newline characters remain line breaks even when a text box is widened.

When typing introduces a character missing from an embedded subset, the editor first selects a compatible complete face of the same family. Otherwise it explicitly switches to the block's standard PDF font alternative and shows a dismissible notice with an option to load the complete original font. Size, weight, style and color are retained. This prevents missing digits from becoming invisible. It does not claim that a substitute has identical metrics to the original.

The font notice follows the selected text and always displays its original face and current editing face. Allowlisted fonts can be downloaded and applied with one button. Calibri offers an explicitly labelled Carlito alternative from the pinned Google Fonts repository; it never downloads or claims to install Calibri. A chosen family is reused for subsequent missing-glyph edits within the same document. All four styles are loaded into both the live editor and export worker. Download failures retain the current text/font and allow retry; a document switch cancels application to the old document. The import button remains available for the exact original TTF/OTF. Fonts are loaded only into the editor, not installed into the operating system.

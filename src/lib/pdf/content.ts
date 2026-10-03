import type { RawFont } from "./fonts";
import type { WrappedPdfiumModule } from "@embedpdf/pdfium";

export type Matrix = [number, number, number, number, number, number];
export type SourceText = {
  page: number;
  paths: number[][];
  text: string;
  bounds: number[];
  matrix: Matrix;
  size: number;
  color: string;
  font: string;
  originalFont?: string;
  embeddedFontId?: string;
  bold: boolean;
  italic: boolean;
};
const identity: Matrix = [1, 0, 0, 1, 0, 0];
export function transform(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
export function multiply(a: Matrix, b: Matrix): Matrix {
  const p = transform(a, b[4], b[5]);
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    ...p,
  ];
}
export function inverse(m: Matrix): Matrix {
  const d = m[0] * m[3] - m[1] * m[2];
  if (!d) throw new Error("Invalid page transform");
  return [
    m[3] / d,
    -m[1] / d,
    -m[2] / d,
    m[0] / d,
    (m[2] * m[5] - m[3] * m[4]) / d,
    (m[1] * m[4] - m[0] * m[5]) / d,
  ];
}

// A fresh native document per transaction makes undo deterministic and keeps the
// uploaded bytes immutable. No masks, rasterisation, or invisible old text.
export function withDocument<T>(
  m: WrappedPdfiumModule,
  bytes: Uint8Array,
  fn: (doc: number) => T,
): T {
  const ptr = m.pdfium.wasmExports.malloc(bytes.length);
  let doc = 0;
  try {
    m.pdfium.HEAPU8.set(bytes, ptr);
    doc = m.FPDF_LoadMemDocument(ptr, bytes.length, "");
    if (!doc) throw new Error("PDF could not be opened");
    return fn(doc);
  } finally {
    if (doc) m.FPDF_CloseDocument(doc);
    m.pdfium.wasmExports.free(ptr);
  }
}
export function extractSources(
  m: WrappedPdfiumModule,
  bytes: Uint8Array,
  fonts?: RawFont[],
): SourceText[] {
  return withDocument(m, bytes, (doc) => {
    const result: SourceText[] = [];
    const fontIds = new Map<number, string>();
    const buf = m.pdfium.wasmExports.malloc(64);
    const floats = (n: number) =>
      Array.from(m.pdfium.HEAPF32.subarray(buf / 4, buf / 4 + n));
    try {
      for (let pn = 0; pn < m.FPDF_GetPageCount(doc); pn++) {
        const page = m.FPDF_LoadPage(doc, pn);
        let tp = 0;
        try {
          tp = m.FPDFText_LoadPage(page);
          const walk = (
            parent: number,
            path: number[],
            ctm: Matrix,
            depth: number,
          ) => {
            if (depth > 20)
              throw new Error("PDF nesting exceeds editing limit");
            const count = path.length
              ? m.FPDFFormObj_CountObjects(parent)
              : m.FPDFPage_CountObjects(parent);
            for (let i = 0; i < count; i++) {
              const obj = path.length
                  ? m.FPDFFormObj_GetObject(parent, i)
                  : m.FPDFPage_GetObject(parent, i),
                type = m.FPDFPageObj_GetType(obj);
              if (!m.FPDFPageObj_GetMatrix(obj, buf)) continue;
              const matrix = multiply(ctm, floats(6) as Matrix),
                key = [...path, i];
              if (type === 5) {
                walk(obj, key, matrix, depth + 1);
                continue;
              }
              if (type !== 1 || m.FPDFTextObj_GetTextRenderMode(obj) !== 0)
                continue;
              const len = m.FPDFTextObj_GetText(obj, tp, 0, 0);
              if (len < 3) continue;
              const str = m.pdfium.wasmExports.malloc(len);
              let text = "";
              try {
                m.FPDFTextObj_GetText(obj, tp, str, len);
                text = new TextDecoder("utf-16le").decode(
                  m.pdfium.HEAPU8.slice(str, str + len - 2),
                );
              } finally {
                m.pdfium.wasmExports.free(str);
              }
              if (!text.trim()) continue;
              if (
                !m.FPDFPageObj_GetBounds(obj, buf, buf + 4, buf + 8, buf + 12)
              )
                continue;
              const [l, b, r, t] = floats(4),
                corners = [
                  transform(ctm, l, b),
                  transform(ctm, r, b),
                  transform(ctm, l, t),
                  transform(ctm, r, t),
                ];
              m.FPDFTextObj_GetFontSize(obj, buf);
              const size = floats(1)[0] * Math.hypot(matrix[0], matrix[1]);
              m.FPDFPageObj_GetFillColor(obj, buf, buf + 4, buf + 8, buf + 12);
              const rgba = Array.from(
                m.pdfium.HEAPU32.subarray(buf / 4, buf / 4 + 4),
              );
              if (rgba[3] !== 255) continue;
              const color =
                "#" +
                rgba
                  .slice(0, 3)
                  .map((x) => x.toString(16).padStart(2, "0"))
                  .join("");
              const fontHandle = m.FPDFTextObj_GetFont(obj),
                length = m.FPDFFont_GetBaseFontName(fontHandle, 0, 0),
                namePtr = m.pdfium.wasmExports.malloc(Math.max(length, 1));
              let name = "";
              try {
                m.FPDFFont_GetBaseFontName(fontHandle, namePtr, length);
                name = m.pdfium.UTF8ToString(namePtr);
              } finally {
                m.pdfium.wasmExports.free(namePtr);
              }
              let embeddedFontId = fontIds.get(fontHandle);
              if (
                fonts &&
                !fontIds.has(fontHandle) &&
                m.FPDFFont_GetIsEmbedded(fontHandle) === 1
              ) {
                fontIds.set(fontHandle, "");
                if (m.FPDFFont_GetFontData(fontHandle, 0, 0, buf)) {
                  const dataLength = m.pdfium.HEAPU32[buf / 4];
                  if (dataLength > 0 && dataLength <= 10 * 1024 * 1024) {
                    const dataPtr = m.pdfium.wasmExports.malloc(dataLength);
                    try {
                      if (
                        m.FPDFFont_GetFontData(
                          fontHandle,
                          dataPtr,
                          dataLength,
                          buf,
                        )
                      ) {
                        embeddedFontId = `embedded-${fonts.length}`;
                        fonts.push({
                          id: embeddedFontId,
                          name,
                          data: m.pdfium.HEAPU8.slice(
                            dataPtr,
                            dataPtr + dataLength,
                          ),
                        });
                        fontIds.set(fontHandle, embeddedFontId);
                      }
                    } finally {
                      m.pdfium.wasmExports.free(dataPtr);
                    }
                  }
                }
              }
              result.push({
                page: pn + 1,
                paths: [key],
                text,
                bounds: [
                  Math.min(...corners.map((p) => p[0])),
                  Math.min(...corners.map((p) => p[1])),
                  Math.max(...corners.map((p) => p[0])),
                  Math.max(...corners.map((p) => p[1])),
                ],
                matrix,
                size,
                color,
                originalFont: name,
                embeddedFontId,
                font:
                  /Times|serif/i.test(name) && !/sans/i.test(name)
                    ? "Times"
                    : /Courier|mono/i.test(name)
                      ? "Courier"
                      : "Helvetica",
                bold: /bold|black/i.test(name),
                italic: /italic|oblique/i.test(name),
              });
            }
          };
          walk(page, [], identity, 0);
        } finally {
          if (tp) m.FPDFText_ClosePage(tp);
          m.FPDF_ClosePage(page);
        }
      }
    } finally {
      m.pdfium.wasmExports.free(buf);
    }
    return result;
  });
}
export function removeSources(
  m: WrappedPdfiumModule,
  bytes: Uint8Array,
  sources: SourceText[],
): Uint8Array {
  if (!sources.length) return bytes.slice();
  return withDocument(m, bytes, (doc) => {
    for (const pn of new Set(sources.map((s) => s.page))) {
      const page = m.FPDF_LoadPage(doc, pn - 1);
      try {
        // Top-level text is removed by identity, never by a box that can touch neighbours.
        const pageSources = sources.filter((s) => s.page === pn);
        const objects = pageSources
          .filter((s) => s.paths[0].length === 1)
          .map((s) => m.FPDFPage_GetObject(page, s.paths[0][0]));
        for (const obj of objects) {
          if (!obj || !m.FPDFPage_RemoveObject(page, obj))
            throw new Error("UNSAFE_TEXT_OVERLAP");
          m.FPDFPageObj_Destroy(obj);
        }
        // Nested form streams need the recursive redactor to persist their changes.
        // A previous region may already have removed a fragment; verifyRemoval checks the result.
        const rect = m.pdfium.wasmExports.malloc(16);
        try {
          for (const source of pageSources.filter(
            (s) => s.paths[0].length > 1,
          )) {
            const [l, b, r, t] = source.bounds;
            m.pdfium.HEAPF32.set(
              [l - 0.01, t + 0.01, r + 0.01, b - 0.01],
              rect / 4,
            );
            m.EPDFText_RedactInRect(page, rect, true, false);
          }
        } finally {
          m.pdfium.wasmExports.free(rect);
        }
        if (!m.FPDFPage_GenerateContent(page))
          throw new Error("Could not regenerate PDF content");
      } finally {
        m.FPDF_ClosePage(page);
      }
    }
    const writer = m.PDFiumExt_OpenFileWriter();
    let ptr = 0;
    try {
      if (!m.FPDF_SaveAsCopy(doc, writer, 2))
        throw new Error("Could not save PDF");
      const len = m.PDFiumExt_GetFileWriterSize(writer);
      ptr = m.pdfium.wasmExports.malloc(len);
      m.PDFiumExt_GetFileWriterData(writer, ptr, len);
      return m.pdfium.HEAPU8.slice(ptr, ptr + len);
    } finally {
      if (ptr) m.pdfium.wasmExports.free(ptr);
      m.PDFiumExt_CloseFileWriter(writer);
    }
  });
}

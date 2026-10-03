import type { WrappedPdfiumModule } from "@embedpdf/pdfium";
import {
  withDocument,
  transform,
  multiply,
  type Matrix,
  type SourceText,
} from "./content";
import type { Geometry, TextObject } from "./document";
export type Cell = { x: number; y: number; width: number; height: number };
export type CellGroup = { page: number; cells: Cell[]; decorations: string[] };
const sourceKey = (s: SourceText) => `${s.page}:${s.paths[0].join(".")}`;
export function detectCells(
  m: WrappedPdfiumModule,
  bytes: Uint8Array,
  sources: SourceText[],
  geometry: Geometry[],
): CellGroup[] {
  const groups: CellGroup[] = [];
  for (let page = 1; page <= geometry.length; page++) {
    const pipes = sources.filter(
      (s) =>
        s.page === page &&
        /^\|\s*(\/\s*)?$/.test(s.text) &&
        Math.abs(s.matrix[1]) < 0.01,
    );
    const rows: SourceText[][] = [];
    for (const s of pipes) {
      const row = rows.find((r) => Math.abs(r[0].bounds[1] - s.bounds[1]) < 1);
      if (row) row.push(s);
      else rows.push([s]);
    }
    for (const row of rows) {
      row.sort((a, b) => a.bounds[0] - b.bounds[0]);
      if (row.length < 4) continue;
      const cells: Cell[] = [];
      for (let i = 0; i < row.length - 1; i++) {
        const a = row[i],
          b = row[i + 1],
          gap = b.bounds[0] - a.bounds[0],
          h = a.bounds[3] - a.bounds[1];
        if (gap < h * 0.7 || gap > h * 2.5 || a.text.includes("/")) continue;
        if (
          sources.some(
            (s) =>
              s.page === page &&
              /^[\s/\-]+$/.test(s.text) &&
              s.bounds[0] > a.bounds[0] &&
              s.bounds[2] < b.bounds[0] &&
              Math.abs(s.bounds[1] - a.bounds[1]) < h,
          )
        )
          continue;
        const vp = geometry[page - 1].matrix;
        if (Math.abs(vp[1]) + Math.abs(vp[2]) > 0.01) continue;
        const p = transform(vp, a.bounds[0] + 0.8, a.bounds[3]),
          q = transform(vp, b.bounds[0], a.bounds[1]);
        cells.push({
          x: Math.min(p[0], q[0]),
          y: Math.min(p[1], q[1]),
          width: Math.abs(q[0] - p[0]),
          height: Math.abs(q[1] - p[1]),
        });
      }
      if (cells.length >= 3)
        groups.push({ page, cells, decorations: row.map(sourceKey) });
    }
  }
  withDocument(m, bytes, (doc) => {
    const buf = m.pdfium.wasmExports.malloc(64);
    try {
      for (let pn = 0; pn < geometry.length; pn++) {
        const page = m.FPDF_LoadPage(doc, pn),
          boxes: Cell[] = [];
        const vertical: Cell[] = [],
          horizontal: Cell[] = [];
        const floats = (n: number) =>
          Array.from(m.pdfium.HEAPF32.subarray(buf / 4, buf / 4 + n));
        const walk = (
          parent: number,
          nested: boolean,
          ctm: Matrix,
          depth: number,
        ) => {
          if (depth > 20) return;
          const count = nested
            ? m.FPDFFormObj_CountObjects(parent)
            : m.FPDFPage_CountObjects(parent);
          for (let i = 0; i < count; i++) {
            const obj = nested
                ? m.FPDFFormObj_GetObject(parent, i)
                : m.FPDFPage_GetObject(parent, i),
              type = m.FPDFPageObj_GetType(obj);
            if (!m.FPDFPageObj_GetMatrix(obj, buf)) continue;
            const matrix = multiply(ctm, floats(6) as Matrix);
            if (type === 5) {
              walk(obj, true, matrix, depth + 1);
              continue;
            }
            if (type !== 2) continue;
            const n = m.FPDFPath_CountSegments(obj);
            if (
              n < 2 ||
              n > 64 ||
              !m.FPDFPath_GetDrawMode(obj, buf, buf + 4) ||
              !m.pdfium.HEAP32[buf / 4 + 1]
            )
              continue;
            const pts: number[][] = [];
            for (let j = 0; j < n; j++) {
              const seg = m.FPDFPath_GetPathSegment(obj, j);
              m.FPDFPathSegment_GetPoint(seg, buf, buf + 4);
              const p = floats(2);
              const point = transform(
                multiply(geometry[pn].matrix, matrix),
                p[0],
                p[1],
              );
              const previous = pts.at(-1);
              if (previous && m.FPDFPathSegment_GetType(seg) === 0) {
                const x = Math.min(point[0], previous[0]),
                  y = Math.min(point[1], previous[1]),
                  width = Math.abs(point[0] - previous[0]),
                  height = Math.abs(point[1] - previous[1]);
                if (width < 0.5 && height >= 7 && height <= 32)
                  vertical.push({ x, y, width, height });
                if (height < 0.5 && width >= 7)
                  horizontal.push({ x, y, width, height });
              }
              pts.push(point);
            }
            if (
              n < 4 ||
              n > 20 ||
              !m.FPDFPathSegment_GetClose(m.FPDFPath_GetPathSegment(obj, n - 1))
            )
              continue;
            const x = Math.min(...pts.map((p) => p[0])),
              y = Math.min(...pts.map((p) => p[1])),
              w = Math.max(...pts.map((p) => p[0])) - x,
              h = Math.max(...pts.map((p) => p[1])) - y;
            if (
              w < 7 ||
              w > 32 ||
              h < 7 ||
              h > 32 ||
              w / h < 0.7 ||
              w / h > 1.4
            )
              continue;
            if (
              !pts.every(
                (p) =>
                  Math.min(p[0] - x, x + w - p[0]) < w * 0.22 ||
                  Math.min(p[1] - y, y + h - p[1]) < h * 0.22,
              )
            )
              continue;
            if (
              !boxes.some((b) => Math.abs(b.x - x) < 1 && Math.abs(b.y - y) < 1)
            )
              boxes.push({ x, y, width: w, height: h });
          }
        };
        try {
          walk(page, false, [1, 0, 0, 1, 0, 0], 0);
        } finally {
          m.FPDF_ClosePage(page);
        }
        boxes.sort((a, b) => a.y - b.y || a.x - b.x);
        const used = new Set<Cell>();
        for (const box of boxes) {
          if (used.has(box)) continue;
          const row = boxes
            .filter(
              (b) =>
                Math.abs(b.y - box.y) < 1.5 &&
                Math.abs(b.height - box.height) < 1.5,
            )
            .sort((a, b) => a.x - b.x);
          const chain: Cell[] = [box];
          let right = box.x + box.width;
          for (const b of row) {
            if (b.x <= box.x) continue;
            if (b.x - right < -0.5) continue;
            if (b.x - right > box.width * 0.5) break;
            chain.push(b);
            right = b.x + b.width;
          }
          if (chain.length >= 2) {
            chain.forEach((b) => used.add(b));
            groups.push({ page: pn + 1, cells: chain, decorations: [] });
          }
        }
        // Shared-border combs drawn as separate line segments rather than boxes.
        const seen = new Set<number>();
        vertical.sort((a, b) => a.y - b.y || a.x - b.x);
        for (let n = 0; n < vertical.length; n++) {
          if (seen.has(n)) continue;
          const first = vertical[n];
          const row = vertical
            .map((v, i) => ({ v, i }))
            .filter(
              ({ v }) =>
                Math.abs(v.y - first.y) < 1 &&
                Math.abs(v.height - first.height) < 1,
            )
            .sort((a, b) => a.v.x - b.v.x);
          row.forEach(({ i }) => seen.add(i));
          const unique = row
            .map(({ v }) => v)
            .filter((v, i, a) => !i || Math.abs(v.x - a[i - 1].x) > 0.7);
          const cells: Cell[] = [];
          for (let i = 0; i < unique.length - 1; i++) {
            const a = unique[i],
              b = unique[i + 1],
              width = b.x - a.x;
            if (width < a.height * 0.6 || width > a.height * 2) continue;
            if (
              !horizontal.some(
                (h) =>
                  h.x <= a.x + 0.8 &&
                  h.x + h.width >= b.x - 0.8 &&
                  (Math.abs(h.y - a.y) < 1 ||
                    Math.abs(h.y - a.y - a.height) < 1),
              )
            )
              continue;
            const cell = { x: a.x, y: a.y, width, height: a.height };
            if (
              groups.some(
                (g) =>
                  g.page === pn + 1 &&
                  g.cells.some(
                    (c) =>
                      Math.abs(c.x - cell.x) < 1.5 &&
                      Math.abs(c.y - cell.y) < 1.5,
                  ),
              )
            )
              continue;
            cells.push(cell);
          }
          if (cells.length >= 2)
            groups.push({ page: pn + 1, cells, decorations: [] });
        }
      }
    } finally {
      m.pdfium.wasmExports.free(buf);
    }
  });
  return groups;
}
export function cellObjects(
  groups: CellGroup[],
  sources: SourceText[],
  geometry: Geometry[],
): { objects: TextObject[]; consumed: Set<string> } {
  const consumed = new Set<string>();
  const objects = groups.map((group, index) => {
    group.decorations.forEach((key) => consumed.add(key));
    const contained: SourceText[] = [];
    const x = Math.min(...group.cells.map((c) => c.x)),
      y = Math.min(...group.cells.map((c) => c.y));
    const text = group.cells
      .map((c) => {
        const matches = sources.filter((s) => {
          if (
            s.page !== group.page ||
            consumed.has(sourceKey(s)) ||
            [...s.text.trim()].length !== 1
          )
            return false;
          const p = transform(
            geometry[s.page - 1].matrix,
            (s.bounds[0] + s.bounds[2]) / 2,
            (s.bounds[1] + s.bounds[3]) / 2,
          );
          return (
            p[0] > c.x &&
            p[0] < c.x + c.width &&
            p[1] > c.y &&
            p[1] < c.y + c.height
          );
        });
        matches.forEach((s) => {
          contained.push(s);
          consumed.add(sourceKey(s));
        });
        return matches[0]?.text.trim() || " ";
      })
      .join("")
      .trimEnd();
    return {
      id: `cells-${group.page}-${index}`,
      kind: "text" as const,
      page: group.page,
      x,
      y,
      width: Math.max(...group.cells.map((c) => c.x + c.width)) - x,
      height: Math.max(...group.cells.map((c) => c.height)),
      rotation: 0,
      text,
      size:
        contained[0]?.size ||
        Math.min(...group.cells.map((c) => c.height)) * 0.9,
      font: "Helvetica",
      bold: false,
      italic: false,
      color: contained[0]?.color || "#111111",
      sources: contained,
      cells: group.cells.map((c) => ({ ...c, x: c.x - x, y: c.y - y })),
    };
  });
  return { objects, consumed };
}
export function cellCharacters(text: string, capacity: number): string {
  return [...text.normalize("NFC").replace(/[\s/|\-]/g, "")]
    .slice(0, capacity)
    .join("");
}
export { sourceKey };

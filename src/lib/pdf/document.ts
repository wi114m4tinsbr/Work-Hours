import fontkit from "@pdf-lib/fontkit";
import { matchingFont, supportsText, type FontAsset } from "./fonts";
import {
  PDFDocument,
  StandardFonts,
  PDFFont,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  rgb,
  degrees,
} from "pdf-lib";
import type { WrappedPdfiumModule } from "@embedpdf/pdfium";
import {
  extractSources,
  removeSources,
  transform,
  inverse,
  type Matrix,
  type SourceText,
} from "./content";
export type Geometry = { width: number; height: number; matrix: Matrix };
export type TextObject = {
  id: string;
  kind: "text";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  text: string;
  size: number;
  font: string;
  bold: boolean;
  italic: boolean;
  color: string;
  sources: SourceText[];
  changed?: boolean;
  deleted?: boolean;
};
export type ImageObject = {
  id: string;
  kind: "image";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  data: string;
  changed: true;
  deleted?: boolean;
};
export type EditorObject = TextObject | ImageObject;
export type FieldValue = string | string[] | boolean;
export type EditorState = {
  objects: EditorObject[];
  fields: Record<string, FieldValue>;
};
export function groupSources(
  sources: SourceText[],
  pages: Geometry[],
): TextObject[] {
  const objects: TextObject[] = [];
  for (const s of sources) {
    const vp = pages[s.page - 1].matrix,
      [l, b, r, t] = s.bounds,
      corners = [
        transform(vp, l, b),
        transform(vp, l, t),
        transform(vp, r, b),
        transform(vp, r, t),
      ],
      baseline = transform(vp, s.matrix[4], s.matrix[5]),
      end = transform(vp, s.matrix[4] + s.matrix[0], s.matrix[5] + s.matrix[1]),
      rotation =
        (Math.atan2(end[1] - baseline[1], end[0] - baseline[0]) * 180) /
        Math.PI;
    const x = Math.min(...corners.map((p) => p[0])),
      y = Math.min(...corners.map((p) => p[1])),
      width = Math.max(3, Math.max(...corners.map((p) => p[0])) - x),
      height = Math.max(s.size, Math.max(...corners.map((p) => p[1])) - y);
    const prev = objects.at(-1),
      gap = prev ? x - prev.x - prev.width : Infinity;
    // Merge adjacent fragments only within the same content holder and baseline.
    if (
      prev &&
      Math.abs(rotation) < 0.1 &&
      Math.abs(prev.rotation) < 0.1 &&
      prev.page === s.page &&
      Math.abs(prev.y - y) < s.size * 0.25 &&
      Math.abs(prev.size - s.size) < 0.2 &&
      gap >= -s.size * 0.5 &&
      gap < s.size * 0.65 &&
      prev.font === s.font &&
      prev.sources[0].originalFont === s.originalFont &&
      prev.bold === s.bold &&
      prev.italic === s.italic &&
      prev.color === s.color &&
      prev.sources[0].paths[0].slice(0, -1).join(".") ===
        s.paths[0].slice(0, -1).join(".")
    ) {
      prev.text +=
        (gap > s.size * 0.2 && !/\s$/.test(prev.text) && !/^\s/.test(s.text)
          ? " "
          : "") + s.text;
      prev.width = x + width - prev.x;
      prev.height = Math.max(prev.height, height);
      prev.sources.push(s);
    } else
      objects.push({
        id: `text-${s.page}-${s.paths[0].join(".")}`,
        kind: "text",
        page: s.page,
        x,
        y,
        width: width + 2,
        height,
        rotation,
        text: s.text,
        size: s.size,
        font: s.font,
        bold: s.bold,
        italic: s.italic,
        color: s.color,
        sources: [s],
      });
  }
  return objects;
}
export function fontName(n: TextObject): StandardFonts {
  const names =
    n.font === "Times"
      ? [
          StandardFonts.TimesRoman,
          StandardFonts.TimesRomanBold,
          StandardFonts.TimesRomanItalic,
          StandardFonts.TimesRomanBoldItalic,
        ]
      : n.font === "Courier"
        ? [
            StandardFonts.Courier,
            StandardFonts.CourierBold,
            StandardFonts.CourierOblique,
            StandardFonts.CourierBoldOblique,
          ]
        : [
            StandardFonts.Helvetica,
            StandardFonts.HelveticaBold,
            StandardFonts.HelveticaOblique,
            StandardFonts.HelveticaBoldOblique,
          ];
  return names[Number(n.bold) + 2 * Number(n.italic)];
}
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  const lines: string[] = [];
  for (const line of text
    .normalize("NFC")
    .replace(
      /[\uFB00-\uFB06]/g,
      (c) =>
        ["ff", "fi", "fl", "ffi", "ffl", "st", "st"][c.charCodeAt(0) - 0xfb00],
    )
    .split(/\r?\n/)) {
    let current = "";
    for (const token of line.split(/(\s+)/)) {
      if (current && font.widthOfTextAtSize(current + token, size) > width) {
        lines.push(current.trimEnd());
        current = "";
      }
      for (const ch of token) {
        if (current && font.widthOfTextAtSize(current + ch, size) > width) {
          lines.push(current);
          current = "";
        }
        current += ch;
      }
    }
    lines.push(current);
  }
  return lines;
}
function pagePoint(g: Geometry, o: EditorObject, x: number, y: number) {
  const a = (o.rotation * Math.PI) / 180;
  return transform(
    inverse(g.matrix),
    o.x + x * Math.cos(a) - y * Math.sin(a),
    o.y + x * Math.sin(a) + y * Math.cos(a),
  );
}
function verifyRemoval(
  m: WrappedPdfiumModule,
  original: SourceText[],
  removed: SourceText[],
  bytes: Uint8Array,
) {
  const ids = new Set(removed.map((s) => `${s.page}:${s.paths[0].join(".")}`));
  const group = (items: SourceText[]) => {
    const map = new Map<string, SourceText[]>();
    for (const s of items) {
      const key = `${s.page}:${s.text}`;
      map.set(key, [...(map.get(key) || []), s]);
    }
    for (const group of map.values())
      group.sort(
        (a, b) => a.bounds[0] - b.bounds[0] || a.bounds[1] - b.bounds[1],
      );
    return map;
  };
  const expected = group(
      original.filter((s) => !ids.has(`${s.page}:${s.paths[0].join(".")}`)),
    ),
    actual = group(extractSources(m, bytes));
  if (expected.size !== actual.size) throw new Error("UNSAFE_TEXT_OVERLAP");
  for (const [key, wanted] of expected) {
    const found = actual.get(key);
    if (
      !found ||
      wanted.length !== found.length ||
      wanted.some((s, i) =>
        s.bounds.some((v, j) => Math.abs(v - found[i].bounds[j]) > 0.05),
      )
    )
      throw new Error("UNSAFE_TEXT_OVERLAP");
  }
}
export function createExporter(
  m: WrappedPdfiumModule,
  bytes: Uint8Array,
  sources: SourceText[],
  geometry: Geometry[],
  assets: FontAsset[] = [],
) {
  let cachedKey = "",
    cachedBase = bytes;
  return async (
    state: EditorState,
    onLayout?: (heights: Record<string, number>) => void,
  ) => {
    const heights: Record<string, number> = {};
    const changed = state.objects.filter((o) => o.changed || o.deleted),
      removed = changed.flatMap((o) => (o.kind === "text" ? o.sources : [])),
      key = removed
        .map((s) => s.page + ":" + s.paths[0].join("."))
        .sort()
        .join("|");
    if (key !== cachedKey) {
      const clean = removeSources(m, bytes, removed);
      verifyRemoval(m, sources, removed, clean);
      cachedBase = clean;
      cachedKey = key;
    }
    if (!changed.length && !Object.keys(state.fields).length)
      return bytes.slice();
    const doc = await PDFDocument.load(cachedBase),
      fonts = new Map<string, PDFFont>();
    doc.registerFontkit(fontkit);
    for (const o of changed) {
      if (o.deleted) continue;
      const p = doc.getPage(o.page - 1),
        g = geometry[o.page - 1],
        origin = pagePoint(g, o, 0, 0),
        axis = pagePoint(g, o, 1, 0),
        angle =
          (Math.atan2(axis[1] - origin[1], axis[0] - origin[0]) * 180) /
          Math.PI;
      if (o.kind === "text") {
        const custom = !["Helvetica", "Times", "Courier"].includes(o.font);
        const asset = matchingFont(assets, o.font, o.bold, o.italic);
        if (custom && !asset) throw new Error("FONT_VARIANT");
        if (asset && !supportsText(asset, o.text))
          throw new Error("FONT_GLYPH");
        const name = asset?.id || fontName(o);
        let font = fonts.get(name);
        if (!font) {
          font = await doc.embedFont(
            asset ? asset.data : name,
            asset ? { subset: true, customName: asset.name } : undefined,
          );
          fonts.set(name, font);
        }
        const lines = wrapText(o.text, font, o.size, Math.max(1, o.width)),
          hex = o.color.slice(1),
          color = rgb(
            parseInt(hex.slice(0, 2), 16) / 255,
            parseInt(hex.slice(2, 4), 16) / 255,
            parseInt(hex.slice(4, 6), 16) / 255,
          ),
          ascent = font.heightAtSize(o.size, { descender: false });
        heights[o.id] = Math.max(o.size * 1.2, lines.length * o.size * 1.2);
        for (let i = 0; i < lines.length; i++) {
          const [x, y] = pagePoint(g, o, 0, ascent + i * o.size * 1.2);
          p.drawText(lines[i], {
            x,
            y,
            font,
            size: o.size,
            color,
            rotate: degrees(angle),
          });
        }
      } else {
        const image = o.data.startsWith("data:image/png")
            ? await doc.embedPng(o.data)
            : await doc.embedJpg(o.data),
          [x, y] = pagePoint(g, o, 0, o.height);
        p.drawImage(image, {
          x,
          y,
          width: o.width,
          height: o.height,
          rotate: degrees(angle),
        });
      }
    }
    const form = doc.getForm();
    for (const [name, value] of Object.entries(state.fields)) {
      const field = form.getField(name);
      if (field.isReadOnly()) throw new Error("Read-only field");
      if (field instanceof PDFTextField) field.setText(String(value));
      else if (field instanceof PDFCheckBox)
        value ? field.check() : field.uncheck();
      else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        if (value === "" || (Array.isArray(value) && !value.length))
          field.clear();
        else field.select(value as string | string[]);
      } else if (field instanceof PDFRadioGroup) {
        if (value) {
          // PDF.js exposes the widget appearance name (often "0" or "1").
          // pdf-lib select() expects the corresponding /Opt export value.
          const raw = String(value);
          const index = field.acroField
            .getOnValues()
            .findIndex((v) => v.decodeText() === raw);
          field.select(index >= 0 ? field.getOptions()[index] : raw);
        } else field.clear();
      } else throw new Error("Unsupported form field");
    }
    if (Object.keys(state.fields).length)
      form.updateFieldAppearances(await doc.embedFont(StandardFonts.Helvetica));
    onLayout?.(heights);
    return doc.save();
  };
}

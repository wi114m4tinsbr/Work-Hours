import fontkit from "@pdf-lib/fontkit";
import { matchingFont, type FontAsset } from "./fonts";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import { fontName, wrapText, type TextObject } from "./document";
const fonts = new Map<string, PDFFont>();
let assets: FontAsset[] = [];
const faces: FontFace[] = [];
export function clearDocumentFonts() {
  for (const face of faces) document.fonts.delete(face);
  faces.length = 0;
  for (const a of assets) fonts.delete(a.id);
  assets = [];
}
export async function registerLiveFonts(items: FontAsset[]) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const accepted: FontAsset[] = [];
  for (const a of items) {
    try {
      const font = await doc.embedFont(a.data, { subset: true });
      fonts.set(a.id, font);
      const face = new FontFace(a.id, a.data.slice().buffer as ArrayBuffer);
      try {
        await face.load();
        document.fonts.add(face);
        faces.push(face);
      } catch {
        throw new Error("FONT_INVALID");
      }
      assets.push(a);
      accepted.push(a);
    } catch {
      fonts.delete(a.id);
    }
  }
  return accepted;
}
export function liveFontFamily(o: TextObject) {
  const a = matchingFont(assets, o.font, o.bold, o.italic);
  return a
    ? `"${a.id}"`
    : o.font === "Times"
      ? '"Times New Roman", serif'
      : o.font === "Courier"
        ? '"Courier New", monospace'
        : "Arial, sans-serif";
}
let loading: Promise<void> | undefined;
export function initializeLiveFonts() {
  return (loading ??= (async () => {
    const doc = await PDFDocument.create();
    for (const name of Object.values(StandardFonts))
      if (name !== "Symbol" && name !== "ZapfDingbats")
        fonts.set(name, await doc.embedFont(name));
  })());
}
export function liveLayout(o: TextObject) {
  const font = fonts.get(
    matchingFont(assets, o.font, o.bold, o.italic)?.id || fontName(o),
  );
  try {
    const lines = font
      ? wrapText(o.text, font, o.size, Math.max(1, o.width))
      : o.text.split("\n");
    return {
      lines,
      ascent: font?.heightAtSize(o.size, { descender: false }) || o.size * 0.8,
      height: Math.max(1, lines.length) * o.size * 1.2,
      widths: lines.map((line) => font?.widthOfTextAtSize(line, o.size) || 0),
    };
  } catch {
    return {
      lines: o.text.split("\n"),
      ascent: o.size * 0.8,
      height: o.text.split("\n").length * o.size * 1.2,
      widths: [],
    };
  }
}

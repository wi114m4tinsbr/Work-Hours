import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";
import { fontName, wrapText, type TextObject } from "./document";
const fonts = new Map<string, PDFFont>();
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
  const font = fonts.get(fontName(o));
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

import type { init } from "@embedpdf/pdfium";
import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
let instance: ReturnType<typeof init> | undefined;
export function getPdfium() {
  return (instance ??= fetch(wasmUrl)
    .then((r) => {
      if (!r.ok) throw new Error("PDF engine unavailable");
      return r.arrayBuffer();
    })
    .then(async (wasmBinary) => {
      const { init } = await import("@embedpdf/pdfium");
      return init({ wasmBinary });
    })
    .then((m) => {
      m.PDFiumExt_Init();
      return m;
    })
    .catch((e) => {
      instance = undefined;
      throw e;
    }));
}

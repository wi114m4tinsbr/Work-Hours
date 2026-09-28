import { extractSources } from "./content";
import { createExporter } from "./document";
import { getPdfium } from "./runtime";
import type { EditRequest } from "./worker-client";

let exporter: ReturnType<typeof createExporter> | undefined;
let latestPreview = 0;
let queue = Promise.resolve();
self.onmessage = ({ data }: MessageEvent<EditRequest>) => {
  if (data.kind === "preview") latestPreview = data.id;
  queue = queue.then(async () => {
    try {
      if (data.kind === "init") {
        const engine = await getPdfium();
        const sources = extractSources(engine, data.bytes);
        exporter = createExporter(engine, data.bytes, sources, data.geometry);
        self.postMessage({ id: data.id, sources });
      } else {
        if (data.kind === "preview" && data.id !== latestPreview)
          throw new Error("SUPERSEDED");
        if (!exporter) throw new Error("PDF editor is not ready");
        let heights: Record<string, number> = {};
        const bytes = await exporter(data.state, (h) => {
          heights = h;
        });
        self.postMessage(
          { id: data.id, bytes, heights },
          { transfer: [bytes.buffer] },
        );
      }
    } catch (error) {
      self.postMessage({
        id: data.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};

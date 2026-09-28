import type { FontAsset, RawFont } from "./fonts";
import type { SourceText } from "./content";
import type { EditorState, Geometry } from "./document";
export type EditRequest =
  | { id: number; kind: "init"; bytes: Uint8Array; geometry: Geometry[] }
  | { id: number; kind: "preview" | "export"; state: EditorState }
  | { id: number; kind: "font"; font: RawFont };
type Reply = {
  id: number;
  error?: string;
  sources?: SourceText[];
  fonts?: FontAsset[];
  bytes?: Uint8Array;
  heights?: Record<string, number>;
};
export class PdfEditingClient {
  private worker = new Worker(new URL("./edit.worker.ts", import.meta.url), {
    type: "module",
  });
  private next = 0;
  private closed = false;
  private pending = new Map<
    number,
    { resolve: (r: Reply) => void; reject: (e: Error) => void }
  >();
  constructor() {
    this.worker.onmessage = ({ data }: MessageEvent<Reply>) => {
      const waiter = this.pending.get(data.id);
      if (!waiter) return;
      this.pending.delete(data.id);
      data.error ? waiter.reject(new Error(data.error)) : waiter.resolve(data);
    };
    this.worker.onerror = () =>
      this.fail(new Error("PDF background worker failed"));
  }
  private fail(error: Error) {
    this.closed = true;
    for (const waiter of this.pending.values()) waiter.reject(error);
    this.pending.clear();
  }
  private request(
    data:
      | Omit<Extract<EditRequest, { kind: "init" }>, "id">
      | Omit<Extract<EditRequest, { kind: "preview" | "export" }>, "id">
      | Omit<Extract<EditRequest, { kind: "font" }>, "id">,
  ) {
    if (this.closed)
      return Promise.reject<Reply>(new Error("PDF editor closed"));
    const id = ++this.next;
    return new Promise<Reply>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...data, id });
    });
  }
  async initialize(bytes: Uint8Array, geometry: Geometry[]) {
    return this.request({ kind: "init", bytes, geometry });
  }
  async addFont(font: RawFont) {
    return (await this.request({ kind: "font", font })).fonts![0];
  }
  async preview(state: EditorState) {
    return this.request({ kind: "preview", state });
  }
  async export(state: EditorState) {
    return (await this.request({ kind: "export", state })).bytes!;
  }
  destroy() {
    this.worker.terminate();
    this.fail(new Error("PDF editor closed"));
  }
}

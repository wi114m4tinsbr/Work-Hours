import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { init } from "@embedpdf/pdfium";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { extractSources, type Matrix } from "../src/lib/pdf/content";
import {
  createExporter,
  groupSources,
  type Geometry,
  type TextObject,
} from "../src/lib/pdf/document";
const m = await init({
  wasmBinary: fs.readFileSync("node_modules/@embedpdf/pdfium/dist/pdfium.wasm"),
});
m.PDFiumExt_Init();
import { createFixture as fixture } from "./fixtures";

const geo: Geometry[] = [1, 2].map(() => ({
  width: 500,
  height: 700,
  matrix: [1, 0, 0, -1, 0, 700],
}));
test("replacement removes original, preserves other text, forms, backgrounds and original bytes", async () => {
  const bytes = await fixture(),
    before = bytes.slice(),
    sources = extractSources(m, bytes),
    objects = groupSources(sources, geo),
    target = objects.find((o) => o.text === "Original name")!;
  assert.ok(target);
  const render = createExporter(m, bytes, sources, geo);
  const state = {
    objects: objects.map((o) =>
      o === target
        ? { ...o, text: "Edited name", width: 150, changed: true }
        : o,
    ),
    fields: { Name: "Carla", Agree: true, Choice: "1", Country: "ES" },
  };
  const out = await render(state),
    text = extractSources(m, out)
      .map((s) => s.text)
      .join("|");
  assert.ok(!text.includes("Original name"));
  assert.ok(text.includes("Edited name"));
  assert.ok(text.includes("Keep neighbour"));
  assert.ok(text.includes("Second page"));
  assert.deepEqual(bytes, before);
  const d = await PDFDocument.load(out);
  assert.equal(d.getForm().getTextField("Name").getText(), "Carla");
  assert.equal(d.getForm().getCheckBox("Agree").isChecked(), true);
  assert.equal(d.getForm().getRadioGroup("Choice").getSelected(), "B");
  assert.deepEqual(d.getForm().getDropdown("Country").getSelected(), ["ES"]);
  const reset = await render({ objects, fields: {} });
  assert.deepEqual(reset, bytes);
});
test("move, resize, rotate, delete and accented text survive reopen", async () => {
  const bytes = await fixture(),
    sources = extractSources(m, bytes),
    objects = groupSources(sources, geo),
    target = objects.find((o) => o.text === "Original name")!;
  const render = createExporter(m, bytes, sources, geo);
  const out = await render({
    objects: objects.map((o) =>
      o === target
        ? {
            ...o,
            text: "João 1ºDTO",
            x: 220,
            y: 160,
            size: 24,
            width: 200,
            rotation: 30,
            bold: true,
            italic: true,
            color: "#cc1122",
            changed: true,
          }
        : o,
    ),
    fields: {},
  });
  const replacement = extractSources(m, out).find(
    (s) => s.text === "João 1ºDTO",
  )!;
  assert.ok(replacement);
  assert.ok(Math.abs(replacement.size - 24) < 0.1);
  assert.equal(replacement.color, "#cc1122");
  assert.ok(replacement.bold && replacement.italic);
  assert.ok(
    Math.abs(replacement.matrix[4] - target.sources[0].matrix[4]) > 100,
  );
  const deleted = await render({
    objects: objects.map((o) => (o === target ? { ...o, deleted: true } : o)),
    fields: {},
  });
  assert.ok(
    !extractSources(m, deleted).some((s) => s.text === "Original name"),
  );
});
test("editing overlapping page text removes only the selected object", async () => {
  const d = await PDFDocument.create(),
    p = d.addPage([500, 700]);
  p.drawText("Overlap A", { x: 50, y: 600, size: 16 });
  p.drawText("Overlap B", { x: 50, y: 600, size: 16 });
  const bytes = await d.save(),
    sources = extractSources(m, bytes),
    objects = groupSources(sources, geo),
    target = objects[0];
  const out = await createExporter(
    m,
    bytes,
    sources,
    geo,
  )({
    objects: objects.map((o) =>
      o === target ? { ...o, text: "Changed", changed: true } : o,
    ),
    fields: {},
  });
  const texts = extractSources(m, out).map((s) => s.text.trim());
  assert.ok(texts.includes("Changed"));
  assert.ok(texts.includes("Overlap B"));
  assert.ok(!texts.includes("Overlap A"));
});

test("crop and page rotation map edits back into the correct PDF coordinates", async () => {
  const d = await PDFDocument.create(),
    p = d.addPage([500, 700]);
  p.setCropBox(20, 30, 400, 600);
  p.setRotation(degrees(90));
  p.drawText("Rotate me", { x: 100, y: 400, size: 16 });
  const bytes = await d.save(),
    geometry: Geometry[] = [
      { width: 600, height: 400, matrix: [0, 1, 1, 0, -30, -20] as Matrix },
    ],
    sources = extractSources(m, bytes),
    objects = groupSources(sources, geometry);
  const out = await createExporter(
    m,
    bytes,
    sources,
    geometry,
  )({
    objects: objects.map((o) => ({
      ...o,
      text: "Rotated",
      x: 200,
      y: 100,
      width: 150,
      rotation: 0,
      changed: true,
    })),
    fields: {},
  });
  const text = extractSources(m, out).find((s) => s.text === "Rotated")!;
  assert.ok(text);
  assert.ok(Math.abs(text.matrix[4] - 131.488) < 3);
  assert.ok(Math.abs(text.matrix[5] - 230) < 1);
  const reopened = await PDFDocument.load(out);
  assert.equal(reopened.getPage(0).getRotation().angle, 90);
  assert.deepEqual(reopened.getPage(0).getCropBox(), {
    x: 20,
    y: 30,
    width: 400,
    height: 600,
  });
});
const reference = process.env.PDF_REFERENCE;
if (reference)
  test("reference PDF: replace nested text and retain all other recognized text", async () => {
    const bytes = new Uint8Array(fs.readFileSync(reference)),
      sources = extractSources(m, bytes),
      doc = await PDFDocument.load(bytes),
      geometry = doc.getPages().map((p) => ({
        width: p.getWidth(),
        height: p.getHeight(),
        matrix: [1, 0, 0, -1, 0, p.getHeight()] as Matrix,
      })),
      objects = groupSources(sources, geometry);
    const target = objects.find(
      (o) =>
        o.sources[0].paths[0].length > 1 &&
        (process.env.PDF_REFERENCE_TEXT
          ? o.text.trim() === process.env.PDF_REFERENCE_TEXT
          : o.text.trim().length > 3),
    )!;
    assert.ok(target);
    assert.ok(target.sources[0].paths[0].length > 1);
    assert.equal(doc.getForm().getFields().length, 0);
    const out = await createExporter(
      m,
      bytes,
      sources,
      geometry,
    )({
      objects: objects.map((o) =>
        o === target
          ? { ...o, text: "Teste de edição", width: 100, changed: true }
          : o,
      ),
      fields: {},
    });
    const texts = extractSources(m, out).map((s) => s.text.trim());
    assert.ok(!texts.includes(target.text));
    assert.ok(texts.includes("Teste de edição"));
    fs.writeFileSync("/tmp/shifthours-reference-edited.pdf", out);
    console.log(
      `Reference: ${doc.getPageCount()} pages; ${sources.length} source fragments; ${objects.length} selectable blocks.`,
    );
  });

test("nested synthetic text is replaced without changing sibling page content", async () => {
  const bytes = await fixture(),
    sources = extractSources(m, bytes),
    objects = groupSources(sources, geo);
  const target = objects.find((o) => o.text === "Nested original")!;
  assert.ok(target.sources[0].paths[0].length > 1);
  const render = createExporter(m, bytes, sources, geo);
  for (const replacement of ["Nested edited", "Edited again"]) {
    const output = await render({
      objects: objects.map((o) =>
        o === target
          ? { ...o, text: replacement, width: 150, changed: true }
          : o,
      ),
      fields: {},
    });
    const text = extractSources(m, output).map((s) => s.text);
    assert.equal(text.filter((s) => s === replacement).length, 1);
    assert.ok(!text.includes("Nested original"));
    assert.ok(text.includes("Original name"));
    assert.ok(text.includes("Keep neighbour"));
  }
});

test("image/signature export inserts image objects and preserves interactive fields", async () => {
  const bytes = await fixture(),
    sources = extractSources(m, bytes),
    objects = groupSources(sources, geo);
  const data =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  const output = await createExporter(
    m,
    bytes,
    sources,
    geo,
  )({
    objects: [
      ...objects,
      {
        id: "image",
        kind: "image",
        page: 1,
        x: 220,
        y: 240,
        width: 100,
        height: 40,
        rotation: 20,
        data,
        changed: true,
      },
    ],
    fields: {},
  });
  const d = await PDFDocument.load(output);
  assert.ok(d.getPage(0).node.Resources());
  assert.equal(d.getForm().getTextField("Name").getText(), "Initial");
  assert.deepEqual(
    extractSources(m, output).map((s) => s.text),
    sources.map((s) => s.text),
  );
});

test("unsupported replacement characters fail instead of exporting missing glyphs", async () => {
  const bytes = await fixture(),
    sources = extractSources(m, bytes),
    objects = groupSources(sources, geo);
  const target = objects.find((o) => o.text === "Original name")!;
  await assert.rejects(
    createExporter(
      m,
      bytes,
      sources,
      geo,
    )({
      objects: objects.map((o) =>
        o === target ? { ...o, text: "漢字", changed: true } : o,
      ),
      fields: {},
    }),
    /encode|WinAnsi/,
  );
  assert.ok(extractSources(m, bytes).some((s) => s.text === "Original name"));
});

test("embedded font identity, glyph coverage and original face survive export", async () => {
  const { createFontFixture } = await import("./fixtures");
  const { readFont, supportsText } = await import("../src/lib/pdf/fonts");
  const { bytes } = await createFontFixture();
  const raw: any[] = [];
  const sources = extractSources(m, bytes, raw),
    assets = raw.map((r) => readFont(r));
  assert.match(sources[0].originalFont!, /StudioFixture/);
  assert.ok(supportsText(assets[0], "CAPITALS 123"));
  assert.ok(!supportsText(assets[0], "你好"));
  const objects = groupSources(sources, geo).map((o) => ({
    ...o,
    font: assets[0].id,
    text: "CAPITALS 123",
    width: 200,
    changed: true,
  }));
  const render = createExporter(m, bytes, sources, geo, assets);
  const out = await render({ objects, fields: {} }),
    after = extractSources(m, out);
  assert.equal(after[0].text, "CAPITALS 123");
  assert.match(after[0].originalFont!, /StudioFixture/);
  await assert.rejects(
    () =>
      render({
        objects: objects.map((o) => ({ ...o, text: "你好" })),
        fields: {},
      }),
    /FONT_GLYPH/,
  );
  await assert.rejects(
    () =>
      render({
        objects: objects.map((o) => ({ ...o, bold: true })),
        fields: {},
      }),
    /FONT_VARIANT/,
  );
});

test("automatic font downloads use exact allowlisted families and keep offline PDFs usable", async () => {
  const { downloadOriginalFonts } = await import("../src/lib/pdf/fonts");
  const { createFontFixture } = await import("./fixtures");
  const { fontBytes } = await createFontFixture();
  const urls: string[] = [];
  const downloaded = await downloadOriginalFonts(
    ["ABCDEF+Lato-Regular", "Calibri", "Arial", "../../unexpected"],
    (async (url) => {
      urls.push(String(url));
      return new Response(fontBytes);
    }) as typeof fetch,
  );
  assert.equal(urls.length, 4);
  assert.equal(downloaded.length, 4);
  assert.ok(
    urls.every((u) => u.includes("/ofl/lato/Lato-") && !u.includes("Calibri")),
  );
  const offline = await downloadOriginalFonts(["Lato-Regular"], (async () => {
    throw new Error("offline");
  }) as typeof fetch);
  assert.deepEqual(offline, []);
});

test("typing digits into a subset chooses a complete same-family face or a visible standard fallback", async () => {
  const { typingFont, readFont } = await import("../src/lib/pdf/fonts");
  const { createFontFixture } = await import("./fixtures");
  const fixture = await createFontFixture();
  const full = readFont({ id: "full", name: "Full", data: fixture.fontBytes });
  const subset = {
    ...full,
    id: "subset",
    characters: full.characters.filter((c) => c < 48 || c > 57),
  };
  assert.equal(
    typingFont([subset, full], "subset", false, false, "123"),
    "full",
  );
  assert.equal(
    typingFont([subset], "subset", false, false, "123"),
    "Helvetica",
  );
  assert.equal(typingFont([subset], "subset", false, false, "ABC"), "subset");
});

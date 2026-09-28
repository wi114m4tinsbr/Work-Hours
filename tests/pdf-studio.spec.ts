import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { init } from "@embedpdf/pdfium";
import fs from "node:fs";
import { extractSources, withDocument } from "../src/lib/pdf/content";
import { createFixture } from "./fixtures";
let bytes: Uint8Array;
test.beforeAll(async () => {
  bytes = await createFixture();
});
async function load(page: any, query = "") {
  await page.goto("/tests/pdf-studio.html" + query);
  await page.locator('input[accept=".pdf,application/pdf"]').setInputFiles({
    name: "fixture.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(bytes),
  });
  await expect(
    page.getByRole("button", { name: "Original name", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(Baixar|Download|Descargar)$/ }),
  ).toBeEnabled();
}
async function downloaded(page: any, label = "Baixar") {
  const button = page.getByRole("button", { name: label, exact: true });
  await expect(button).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    button.click(),
  ]);
  return new Uint8Array(fs.readFileSync((await download.path())!));
}
test("existing text: replace, format, move, resize, rotate, undo and download without duplication", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await load(page);
  await page
    .getByRole("button", { name: "Original name", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Editar texto" })).toHaveValue(
    "Original name",
  );
  await page
    .getByRole("textbox", { name: "Editar texto" })
    .fill("Updated person");
  await page
    .getByRole("spinbutton", { name: "Tamanho", exact: true })
    .fill("18");
  await page.getByRole("button", { name: "Negrito", exact: true }).click();
  await page.getByRole("button", { name: "Itálico", exact: true }).click();
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Largura", exact: true })
    .fill("180");
  await page
    .getByRole("spinbutton", { name: "Rotação", exact: true })
    .fill("15");
  await page
    .getByRole("button", { name: "Fechar painel", exact: true })
    .click();
  const move = page.getByRole("button", { name: "Mover", exact: true }),
    r = await move.boundingBox();
  await page.mouse.move(r!.x + 10, r!.y + 10);
  await page.mouse.down();
  await page.mouse.move(r!.x + 50, r!.y + 40, { steps: 4 });
  await page.mouse.up();
  const handle = page.getByRole("button", {
      name: "Redimensionar",
      exact: true,
    }),
    h = await handle.boundingBox();
  await page.mouse.move(h!.x + 10, h!.y + 10);
  await page.mouse.down();
  await page.mouse.move(h!.x + 40, h!.y + 20, { steps: 4 });
  await page.mouse.up();
  const out = await downloaded(page);
  const m = await init({
    wasmBinary: fs.readFileSync(
      "node_modules/@embedpdf/pdfium/dist/pdfium.wasm",
    ),
  });
  m.PDFiumExt_Init();
  const text = extractSources(m, out).map((s) => s.text);
  expect(text.filter((s) => s === "Updated person")).toHaveLength(1);
  expect(text).not.toContain("Original name");
  expect(text).toContain("Keep neighbour");
  expect(text).toContain("Nested original");
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Baixar", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: info.outputPath("editor-desktop.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await page.locator('input[accept=".pdf,application/pdf"]').setInputFiles({
    name: "reopened.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(out),
  });
  await expect(
    page.getByRole("button", { name: "Updated person", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Original name", exact: true }),
  ).toHaveCount(0);
});
test("nested objects are removed from the saved PDF, not masked", async ({
  page,
}) => {
  await load(page);
  await page
    .getByRole("button", { name: "Nested original", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Editar texto" })
    .fill("Nested edited");
  const out = await downloaded(page);
  const m = await init({
    wasmBinary: fs.readFileSync(
      "node_modules/@embedpdf/pdfium/dist/pdfium.wasm",
    ),
  });
  m.PDFiumExt_Init();
  const text = extractSources(m, out).map((s) => s.text);
  expect(text).toContain("Nested edited");
  expect(text).not.toContain("Nested original");
  expect(text).toContain("Original name");
});
test("AcroForm values stay interactive; image and drawn signature survive export", async ({
  page,
}, info) => {
  await load(page);
  await page
    .getByRole("combobox", { name: "Página", exact: true })
    .selectOption("2");
  await page
    .getByRole("textbox", { name: "Campo de formulário: Name", exact: true })
    .fill("Updated field");
  await page
    .getByRole("checkbox", { name: "Campo de formulário: Agree", exact: true })
    .check();
  await page
    .getByRole("radio", { name: "Campo de formulário: Choice", exact: true })
    .nth(1)
    .check();
  await page
    .getByRole("combobox", {
      name: "Campo de formulário: Country",
      exact: true,
    })
    .selectOption("ES");
  await page.locator('input[accept="image/png,image/jpeg"]').setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Assinatura", exact: true }).click();
  const canvas = page.getByRole("dialog").locator("canvas"),
    r = await canvas.boundingBox();
  await page.mouse.move(r!.x + 30, r!.y + 50);
  await page.mouse.down();
  await page.mouse.move(r!.x + 160, r!.y + 90, { steps: 10 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Inserir", exact: true }).click();
  const out = await downloaded(page),
    d = await PDFDocument.load(out),
    f = d.getForm();
  expect(f.getTextField("Name").getText()).toBe("Updated field");
  expect(f.getCheckBox("Agree").isChecked()).toBe(true);
  expect(f.getRadioGroup("Choice").getSelected()).toBe("B");
  expect(f.getDropdown("Country").getSelected()).toEqual(["ES"]);
  const native = await init({
    wasmBinary: fs.readFileSync(
      "node_modules/@embedpdf/pdfium/dist/pdfium.wasm",
    ),
  });
  native.PDFiumExt_Init();
  const imageCount = withDocument(native, out, (doc) => {
    const page = native.FPDF_LoadPage(doc, 1);
    try {
      return Array.from(
        { length: native.FPDFPage_CountObjects(page) },
        (_, i) =>
          native.FPDFPageObj_GetType(native.FPDFPage_GetObject(page, i)),
      ).filter((type) => type === 3).length;
    } finally {
      native.FPDF_ClosePage(page);
    }
  });
  expect(imageCount).toBe(2);
  await page.screenshot({
    path: info.outputPath("forms-signature.png"),
    fullPage: true,
  });
});
for (const config of [
  { lang: "pt", dark: false },
  { lang: "en", dark: true },
  { lang: "es", dark: false },
])
  test(`mobile ${config.lang} ${config.dark ? "dark" : "light"} selection and page navigation`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await load(page, `?lang=${config.lang}${config.dark ? "&dark" : ""}`);
    if (config.dark) {
      await page.evaluate(() =>
        document.documentElement.style.setProperty(
          "--primary-color",
          "#7c3aed",
        ),
      );
      await expect(
        page.getByRole("button", { name: "Select", exact: true }),
      ).toHaveCSS("background-color", "rgb(124, 58, 237)");
    }
    const pageLabel = { pt: "Página", en: "Page", es: "Página" }[config.lang],
      editLabel = { pt: "Editar texto", en: "Edit text", es: "Editar texto" }[
        config.lang
      ];
    await page
      .getByRole("button", { name: "Original name", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: editLabel, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: pageLabel, exact: true })
      .selectOption("2");
    await expect(
      page.getByRole("button", { name: "Second page", exact: true }),
    ).toBeVisible();
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      outside: [...document.querySelectorAll("body *")]
        .map((el) => ({
          tag: el.tagName,
          cls: el.className,
          right: el.getBoundingClientRect().right,
        }))
        .filter((el) => el.right > innerWidth),
    }));
    expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(
      overflow.width,
    );
    await expect(
      page.getByRole("button", { name: /^(Baixar|Download|Descargar)$/ }),
    ).toBeEnabled();
    await page.screenshot({
      path: info.outputPath(`mobile-${config.lang}.png`),
      fullPage: true,
    });
  });

test("click to type, live drag and keyboard formatting do not rebuild the page", async ({
  page,
}, info) => {
  await load(page);
  const stage = page.getByTestId("pdf-stage");
  await page
    .getByRole("button", { name: "Adicionar texto", exact: true })
    .click();
  const before = await stage.getAttribute("data-background-renders");
  await stage.click({ position: { x: 300, y: 280 } });
  const editor = page.getByTestId("pdf-inline-editor");
  await expect(editor).toBeFocused();
  await editor.pressSequentially("Instant typing", { delay: 30 });
  await expect(editor).toHaveValue("Instant typing");
  expect(await stage.getAttribute("data-background-renders")).toBe(before);
  await editor.press("Control+b");
  await expect(
    page.getByRole("button", { name: "Negrito", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await editor.press("Control+i");
  await expect(
    page.getByRole("button", { name: "Itálico", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await editor.press("Escape");
  await expect(editor).toHaveCount(0);
  const object = page.locator("[data-pdf-object]").filter({
    has: page.getByRole("button", { name: "Instant typing", exact: true }),
  });
  const start = await object.boundingBox(),
    move = page.getByRole("button", { name: "Mover", exact: true }),
    handle = await move.boundingBox();
  await page.mouse.move(handle!.x + 10, handle!.y + 10);
  await page.mouse.down();
  await page.mouse.move(handle!.x + 80, handle!.y + 50, { steps: 8 });
  const during = await object.boundingBox();
  expect(during!.x - start!.x).toBeGreaterThan(60);
  await expect(object).toHaveAttribute("data-live", "true");
  await page.mouse.up();
  expect(await stage.getAttribute("data-background-renders")).toBe(before);
  await page.screenshot({
    path: info.outputPath("instant-text-drag.png"),
    fullPage: true,
  });
  const out = await downloaded(page);
  const native = await init({
    wasmBinary: fs.readFileSync(
      "node_modules/@embedpdf/pdfium/dist/pdfium.wasm",
    ),
  });
  native.PDFiumExt_Init();
  const texts = extractSources(native, out);
  expect(texts.filter((t) => t.text === "Instant typing")).toHaveLength(1);
  expect(texts.find((t) => t.text === "Instant typing")!.bold).toBe(true);
  expect(texts.find((t) => t.text === "Instant typing")!.italic).toBe(true);
});

test("inline typing keeps one undo step and existing text export stays intact after selection", async ({
  page,
}) => {
  await load(page);
  await page
    .getByRole("button", { name: "Original name", exact: true })
    .click();
  const editor = page.getByTestId("pdf-inline-editor");
  await expect(editor).toBeFocused();
  const before = await page
    .getByTestId("pdf-stage")
    .getAttribute("data-background-renders");
  await editor.press("Control+End");
  await editor.pressSequentially(" with edits", { delay: 25 });
  await expect(editor).toHaveValue("Original name with edits");
  expect(
    await page.getByTestId("pdf-stage").getAttribute("data-background-renders"),
  ).toBe(before);
  await editor.press("Control+z");
  await expect(editor).toHaveValue("Original name");
  await editor.press("Control+Shift+z");
  await expect(editor).toHaveValue("Original name with edits");
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await page
    .getByRole("button", { name: "Restaurar original", exact: true })
    .click();
  const out = await downloaded(page);
  expect(Buffer.from(out).equals(Buffer.from(bytes))).toBe(true);
});

test("single click edits text; widening reflows capitals without scaling the font", async ({
  page,
}, info) => {
  await load(page);
  const original = page.getByRole("button", {
    name: "Original name",
    exact: true,
  });
  await expect(original).toHaveCSS("cursor", "text");
  await original.click();
  const editor = page.getByTestId("pdf-inline-editor");
  await expect(editor).toBeFocused();
  const text = "UM TEXTO MAIS EXTENSO";
  await editor.fill(text);
  const size = page.getByRole("spinbutton", { name: "Tamanho", exact: true });
  const initialSize = await size.inputValue();
  const object = page.locator("[data-pdf-object]").filter({ has: editor });
  const id = await object.getAttribute("data-pdf-object");
  const stableObject = page.locator(`[data-pdf-object="${id}"]`);
  const narrow = await stableObject.boundingBox();
  const handle = page.getByTestId("pdf-width-handle");
  await expect(handle).toHaveCSS("cursor", "ew-resize");
  const bounds = await handle.boundingBox();
  const renders = await page
    .getByTestId("pdf-stage")
    .getAttribute("data-background-renders");
  await page.mouse.move(
    bounds!.x + bounds!.width / 2,
    bounds!.y + bounds!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds!.x + bounds!.width / 2 + 280,
    bounds!.y + bounds!.height / 2,
    { steps: 10 },
  );
  await page.mouse.up();
  const wide = await stableObject.boundingBox();
  expect(wide!.width - narrow!.width).toBeGreaterThan(270);
  expect(wide!.height).toBeLessThan(narrow!.height);
  await expect(size).toHaveValue(initialSize);
  expect(
    await page.getByTestId("pdf-stage").getAttribute("data-background-renders"),
  ).toBe(renders);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  expect((await stableObject.boundingBox())!.width).toBeCloseTo(
    narrow!.width,
    0,
  );
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await expect(size).toHaveValue(initialSize);
  const out = await downloaded(page);
  const native = await init({
    wasmBinary: fs.readFileSync(
      "node_modules/@embedpdf/pdfium/dist/pdfium.wasm",
    ),
  });
  native.PDFiumExt_Init();
  const texts = extractSources(native, out);
  expect(texts.filter((t) => t.text === text)).toHaveLength(1);
  expect(texts.find((t) => t.text === text)!.size).toBeCloseTo(
    Number(initialSize),
    2,
  );
  expect(texts.some((t) => t.text === "Original name")).toBe(false);
  await page.screenshot({
    path: info.outputPath("text-width-single-line.png"),
    fullPage: true,
  });
});

test("font inventory, embedded face, upload and sticky formatting toolbar", async ({
  page,
}, info) => {
  const { createFontFixture } = await import("./fixtures");
  const fixture = await createFontFixture();
  await page.goto("/tests/pdf-studio.html?appHeader");
  await page.locator('input[accept=".pdf,application/pdf"]').setInputFiles({
    name: "fonts.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(fixture.bytes),
  });
  await page
    .getByRole("button", { name: "Original font", exact: true })
    .click();
  await expect(page.getByTestId("pdf-inline-editor")).toBeFocused();
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await expect(page.getByTestId("pdf-font-info")).toContainText(
    "StudioFixture-Regular",
  );
  const font = page.getByRole("combobox", { name: "Fonte", exact: true });
  await expect(font).toHaveValue(/^embedded-/);
  await page.getByTestId("pdf-font-inventory").locator("summary").click();
  await expect(page.getByTestId("pdf-font-inventory")).toContainText(
    "StudioFixture-Regular",
  );
  await page.getByTestId("pdf-font-inventory").locator("summary").click();
  await page
    .getByRole("button", { name: "Fechar painel", exact: true })
    .click();
  await page.getByTestId("pdf-inline-editor").fill("CUSTOM FONT");
  // Whole-document scrolling must retain the toolbar below the real app header.
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect
    .poll(async () =>
      Math.round((await page.getByTestId("pdf-toolbar").boundingBox())!.y),
    )
    .toBe(64);
  await expect(font).toBeInViewport();
  await page
    .getByRole("spinbutton", { name: "Tamanho", exact: true })
    .fill("18");
  let out = await downloaded(page);
  const native = await init({
    wasmBinary: fs.readFileSync(
      "node_modules/@embedpdf/pdfium/dist/pdfium.wasm",
    ),
  });
  native.PDFiumExt_Init();
  expect(extractSources(native, out)[0].originalFont).toContain(
    "StudioFixture",
  );
  await font.selectOption("Helvetica");
  await page.locator('input[accept=".ttf,.otf"]').setInputFiles({
    name: "StudioFixture.ttf",
    mimeType: "font/ttf",
    buffer: Buffer.from(fixture.fontBytes),
  });
  await expect(font).toHaveValue(/^uploaded-/);
  out = await downloaded(page);
  expect(extractSources(native, out)[0].originalFont).toContain(
    "StudioFixture",
  );
  await page.screenshot({
    path: info.outputPath("sticky-font-toolbar.png"),
    fullPage: false,
  });
  // Loading a new PDF must reset the last typing font, not retain a stale embedded id.
  await page.locator('input[accept=".pdf,application/pdf"]').setInputFiles({
    name: "second.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(bytes),
  });
  await expect(
    page.getByRole("button", { name: "Original name", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Adicionar texto", exact: true })
    .click();
  await page.getByTestId("pdf-stage").click({ position: { x: 300, y: 280 } });
  await expect(page.getByTestId("pdf-inline-editor")).toBeFocused();
  await expect(font).toHaveValue("Helvetica");
  await page.getByTestId("pdf-inline-editor").fill("New document text");
  await downloaded(page);
});

for (const width of [1280, 390]) {
  test(`compact toolbar preserves document space at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 820 });
    await load(page, "?appHeader");
    const toolbar = page.getByTestId("pdf-toolbar");
    expect((await toolbar.boundingBox())!.height).toBeLessThanOrEqual(50);
    await page
      .getByRole("button", { name: "Original name", exact: true })
      .click();
    expect((await toolbar.boundingBox())!.height).toBeLessThanOrEqual(96);
    const more = page.getByRole("button", { name: "Mais opções", exact: true });
    await more.click();
    await expect(
      page.getByRole("region", { name: "Mais opções" }),
    ).toBeVisible();
    await expect(
      page.getByRole("spinbutton", { name: "Largura", exact: true }),
    ).toBeVisible();
    expect((await toolbar.boundingBox())!.height).toBeLessThanOrEqual(96);
    await page.screenshot({ path: info.outputPath("compact-options.png") });
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await page.evaluate(() => window.scrollTo(0, 450));
    await expect
      .poll(async () => Math.round((await toolbar.boundingBox())!.y))
      .toBe(64);
    await expect(
      page.getByRole("button", { name: "Baixar", exact: true }),
    ).toBeInViewport();
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      outside: [...document.querySelectorAll("body *")]
        .map((el) => ({
          tag: el.tagName,
          cls: el.className,
          right: el.getBoundingClientRect().right,
        }))
        .filter((el) => el.right > innerWidth),
    }));
    expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(
      overflow.width,
    );
    await page.screenshot({ path: info.outputPath("compact-scrolled.png") });
  });
}

test("numeric replacement remains visible in dark mode and exports every digit", async ({
  page,
}) => {
  await load(page, "?dark");
  await page
    .getByRole("button", { name: "Original name", exact: true })
    .click();
  const editor = page.getByTestId("pdf-inline-editor");
  await editor.fill("");
  await editor.pressSequentially("0123456789");
  await expect(editor).toHaveValue("0123456789");
  await expect(editor).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.getByRole("alert")).toHaveCount(0);
  const out = await downloaded(page);
  const native = await init({
    wasmBinary: fs.readFileSync(
      "node_modules/@embedpdf/pdfium/dist/pdfium.wasm",
    ),
  });
  native.PDFiumExt_Init();
  const texts = extractSources(native, out)
    .map((s) => s.text)
    .join("");
  expect(texts).toContain("0123456789");
  expect(texts).not.toContain("Original name");
});

test("font notice names the original and loads an explicitly chosen alternative into the editor", async ({
  page,
}) => {
  const { createFontFixture } = await import("./fixtures");
  const fixture = await createFontFixture("Calibri-Bold");
  const requests: string[] = [];
  await page.route(
    "https://raw.githubusercontent.com/google/fonts/**",
    async (route) => {
      requests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "font/ttf",
        body: Buffer.from(fixture.fontBytes),
      });
    },
  );
  await page.goto("/tests/pdf-studio.html");
  await page.locator('input[accept=".pdf,application/pdf"]').setInputFiles({
    name: "font.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(fixture.bytes),
  });
  await page
    .getByRole("button", { name: "Original font", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Fonte", exact: true })
    .selectOption("Helvetica");
  const notice = page.getByTestId("pdf-font-notice");
  await expect(notice).toContainText("Fonte original: Calibri-Bold");
  await notice
    .getByRole("button", {
      name: "Usar alternativa gratuita: Carlito",
      exact: true,
    })
    .click();
  await expect(notice).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Fonte", exact: true }),
  ).toHaveValue(/^download-Carlito-/);
  expect(requests).toHaveLength(4);
  expect(requests.every((url) => url.includes("/ofl/carlito/"))).toBe(true);
  await downloaded(page);
});

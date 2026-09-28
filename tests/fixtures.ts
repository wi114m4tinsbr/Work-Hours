import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
export async function createFixture() {
  const d = await PDFDocument.create(),
    font = await d.embedFont(StandardFonts.Helvetica),
    p = d.addPage([500, 700]);
  p.drawRectangle({
    x: 30,
    y: 550,
    width: 350,
    height: 80,
    color: rgb(0.8, 0.9, 1),
  });
  p.drawText("Original name", { x: 50, y: 600, font, size: 16 });
  p.drawText("Keep neighbour", { x: 50, y: 560, font, size: 16 });
  const nested = await PDFDocument.create(),
    np = nested.addPage([200, 80]);
  np.drawText("Nested original", { x: 10, y: 30, size: 14 });
  const [embedded] = await d.embedPdf(await nested.save());
  p.drawPage(embedded, { x: 50, y: 350, width: 200, height: 80 });
  const p2 = d.addPage([500, 700]);
  p2.drawText("Second page", { x: 50, y: 600, font, size: 16 });
  const form = d.getForm(),
    field = form.createTextField("Name");
  field.setText("Initial");
  field.addToPage(p2, { x: 50, y: 500, width: 180, height: 24 });
  const check = form.createCheckBox("Agree");
  check.addToPage(p2, { x: 50, y: 450, width: 20, height: 20 });
  const radio = form.createRadioGroup("Choice");
  radio.addOptionToPage("A", p2, { x: 90, y: 450, width: 20, height: 20 });
  radio.addOptionToPage("B", p2, { x: 120, y: 450, width: 20, height: 20 });
  const dropdown = form.createDropdown("Country");
  dropdown.addOptions(["PT", "EN", "ES"]);
  dropdown.select("PT");
  dropdown.addToPage(p2, { x: 50, y: 400, width: 180, height: 24 });
  return d.save();
}

export async function createFontFixture(originalName?: string) {
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const fixture = JSON.parse(
    (await import("node:fs")).readFileSync(
      new URL("./font-fixture.json", import.meta.url),
      "utf8",
    ),
  );
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const bytes = Uint8Array.from(atob(fixture.base64), (c) => c.charCodeAt(0));
  const font = await doc.embedFont(bytes, {
    subset: false,
    ...(originalName ? { customName: originalName } : {}),
  });
  doc
    .addPage([500, 700])
    .drawText("Original font", { x: 50, y: 600, font, size: 16 });
  return { bytes: await doc.save(), fontBytes: bytes };
}

export async function createCellFixture() {
  const doc = await PDFDocument.create(),
    page = doc.addPage([500, 700]);
  page.drawText("Process:", { x: 20, y: 600, size: 12 });
  for (const x of [100, 120, 140, 180, 200, 220])
    page.drawText("|", { x, y: 600, size: 14 });
  page.drawText("-", { x: 160, y: 600, size: 14 });
  for (const x of [300, 322, 344])
    page.drawRectangle({
      x,
      y: 500,
      width: 20,
      height: 20,
      borderWidth: 1,
      borderColor: rgb(0, 0, 0),
    });
  page.drawText("P", { x: 306, y: 505, size: 12 });
  page.drawText("T", { x: 328, y: 505, size: 12 });
  return doc.save();
}

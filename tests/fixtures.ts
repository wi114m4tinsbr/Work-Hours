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

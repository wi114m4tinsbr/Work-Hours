import fontkit from "@pdf-lib/fontkit";
export type FontAsset = {
  id: string;
  name: string;
  family: string;
  bold: boolean;
  italic: boolean;
  data: Uint8Array;
  characters: number[];
  origin: "embedded" | "downloaded" | "uploaded";
};
export type RawFont = { id: string; name: string; data: Uint8Array };
export const cleanFontName = (name: string) => name.replace(/^[A-Z]{6}\+/, "");
export function readFont(
  raw: RawFont,
  origin: FontAsset["origin"] = "embedded",
): FontAsset {
  if (raw.data.length > 10 * 1024 * 1024) throw new Error("FONT_INVALID");
  const parsed = fontkit.create(raw.data) as any;
  if (!parsed.characterSet?.length || !parsed.postscriptName)
    throw new Error("FONT_INVALID");
  const name = cleanFontName(parsed.postscriptName),
    style = (parsed.subfamilyName || "") + " " + name;
  const family = cleanFontName(parsed.familyName || name).replace(
    /[-, ](BoldItalic|Bold|Italic|Regular|Oblique)$/i,
    "",
  );
  const characters: number[] = Array.from(
    parsed.characterSet as number[],
  ).filter((c) => {
    try {
      const g = parsed.glyphForCodePoint(c);
      return (
        g.id > 0 &&
        g.id < parsed.numGlyphs &&
        (String.fromCodePoint(c).trim() === "" || g.path.commands.length > 0)
      );
    } catch {
      return false;
    }
  });
  if (!characters.length) throw new Error("FONT_INVALID");
  return {
    ...raw,
    name,
    family,
    bold: /bold|black|heavy/i.test(style),
    italic: /italic|oblique/i.test(style),
    characters,
    origin,
  };
}
export function supportsText(asset: FontAsset, text: string) {
  const chars = new Set(asset.characters);
  return [...text.normalize("NFC")].every(
    (c) => /\s/.test(c) || chars.has(c.codePointAt(0)!),
  );
}
export function matchingFont(
  assets: FontAsset[],
  font: string,
  bold: boolean,
  italic: boolean,
) {
  const base = assets.find((a) => a.id === font);
  if (!base) return undefined;
  return base.bold === bold && base.italic === italic
    ? base
    : assets.find(
        (a) =>
          a.family === base.family && a.bold === bold && a.italic === italic,
      );
}
// Exact family allowlist, pinned official Google Fonts release. Never guess a
// commercial font URL, substitute another family, or send document text online.
const revision = "23e54b51ddffbc7713c583748e3bd86f62b1fa4a";
const downloadable = {
  Lato: "ofl/lato/Lato",
  Ubuntu: "ufl/ubuntu/Ubuntu",
  PTSans: "ofl/ptsans/PT_Sans-Web",
  PTSerif: "ofl/ptserif/PT_Serif-Web",
} as const;
export async function downloadOriginalFonts(
  names: string[],
  fetcher: typeof fetch = fetch,
): Promise<FontAsset[]> {
  const wanted = Object.keys(downloadable).filter((f) =>
    names.some((n) => cleanFontName(n).replace(/[-,].*$/, "") === f),
  );
  const out: FontAsset[] = [];
  await Promise.all(
    wanted.flatMap((family) =>
      ["Regular", "Bold", "Italic", "BoldItalic"].map(async (style) => {
        try {
          const response = await fetcher(
            `https://raw.githubusercontent.com/google/fonts/${revision}/${downloadable[family]}-${style}.ttf`,
            { signal: AbortSignal.timeout(5000) },
          );
          if (!response.ok) return;
          const data = new Uint8Array(await response.arrayBuffer());
          out.push(
            readFont(
              {
                id: `download-${family}-${style}`,
                name: `${family}-${style}`,
                data,
              },
              "downloaded",
            ),
          );
        } catch {
          /* Missing/offline: embedded fonts or an explicit user choice remain available. */
        }
      }),
    ),
  );
  return out;
}

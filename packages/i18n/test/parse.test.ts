import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { languages } from "../../../site.config.ts";
import { ContentParseError, parseContent } from "../src/parse.ts";
import { serializeContent } from "../src/serialize.ts";
import { validateContent } from "../src/validate.ts";

const sample = `<!-- header -->

# kid-one

## settings

hero_name: Captain Comet

## en

### bubble
We played **together**!
Second line with {hero_name}.

### submit
Send

## gsw

<!-- draft src-hash:ab12cd34 -->
### bubble
Mir händ zäme gspielt!

### submit
Schicke
`;

describe("parseContent", () => {
  it("reads pages, settings, languages, keys and markers", () => {
    const doc = parseContent(sample);
    expect(doc.preamble).toBe("<!-- header -->");
    const page = doc.pages["kid-one"]!;
    expect(page.settings).toEqual({ hero_name: "Captain Comet" });
    expect(page.langs.en!.bubble!.text).toBe("We played **together**!\nSecond line with {hero_name}.");
    expect(page.langs.en!.bubble!.marker).toBeUndefined();
    expect(page.langs.gsw!.bubble!.marker).toEqual({ mode: "draft", hash: "ab12cd34" });
    expect(page.langs.gsw!.submit!.marker).toBeUndefined();
  });

  it("attaches a marker that follows a previous body to the next key", () => {
    const doc = parseContent("# p\n## en\n### a\nA\n<!-- auto src-hash:00ff -->\n### b\nB\n");
    expect(doc.pages.p!.langs.en!.a).toEqual({ text: "A" });
    expect(doc.pages.p!.langs.en!.b).toEqual({ text: "B", marker: { mode: "auto", hash: "00ff" } });
  });

  it("rejects broken structure", () => {
    expect(() => parseContent("## en\n")).toThrow(ContentParseError);
    expect(() => parseContent("# p\n### key\n")).toThrow(/outside a language section/);
    expect(() => parseContent("# p\n## en\n### a\nx\n### a\ny\n")).toThrow(/duplicate key/);
    expect(() => parseContent("# p\n## en\n<!-- auto src-hash:aa -->\n## de\n")).toThrow(/marker/);
    expect(() => parseContent("# p\n## settings\nnot a setting\n")).toThrow(/invalid setting/);
  });

  it("round trips through the serializer", () => {
    const order = languages.map((l) => l.code);
    expect(serializeContent(parseContent(sample), order, "en")).toBe(sample);
  });
});

describe("content/content.md", () => {
  const raw = readFileSync(new URL("../../../content/content.md", import.meta.url), "utf8");
  const doc = parseContent(raw);

  it("is in canonical form, so translate runs produce minimal diffs", () => {
    expect(
      serializeContent(
        doc,
        languages.map((l) => l.code),
        "en",
      ),
    ).toBe(raw);
  });

  it("has no validation errors", () => {
    expect(validateContent(doc).errors).toEqual([]);
  });

  it("never contains a phone number or email address of the owner", () => {
    expect(raw).not.toMatch(/\+?\d[\d\s]{8,}\d/);
    expect(raw).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});

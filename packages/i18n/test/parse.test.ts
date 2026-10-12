import { describe, expect, it } from "vitest";
import { languages } from "../../../site.config.ts";
import { ContentParseError, parseContent } from "../src/parse.ts";
import { serializeContent } from "../src/serialize.ts";
import { parseContentFiles, serializeContentFiles } from "../src/files.ts";
import { readContentFiles } from "../src/node.ts";
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

describe("content/<lang>.md", () => {
  const files = readContentFiles();
  const doc = parseContentFiles(files, "en");

  it("every file is in canonical form, so translate runs produce minimal diffs", () => {
    expect(
      serializeContentFiles(
        doc,
        languages.map((l) => l.code),
        "en",
      ),
    ).toEqual(files);
  });

  it("has no validation errors", () => {
    expect(validateContent(doc).errors).toEqual([]);
  });

  it("never contains a phone number or email address of the owner", () => {
    for (const raw of Object.values(files)) {
      expect(raw).not.toMatch(/\+?\d[\d\s]{8,}\d/);
      expect(raw).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    }
  });
});

describe("per-language files", () => {
  const en = "# kids\n\n## settings\n\nparent: dad\n\n## en\n\n### submit\nSend\n";
  const de = "# kids\n\n## de\n\n<!-- auto src-hash:aa -->\n### submit\nSchicken\n";

  it("merges files into one document", () => {
    const doc = parseContentFiles({ en, de }, "en");
    expect(doc.pages.kids!.settings).toEqual({ parent: "dad" });
    expect(doc.pages.kids!.langs.de!.submit).toEqual({
      text: "Schicken",
      marker: { mode: "auto", hash: "aa" },
    });
  });
  it("rejects another language or settings in a translation file", () => {
    expect(() => parseContentFiles({ en, de: "# kids\n## fr\n### submit\nx\n" }, "en")).toThrow(
      /"## fr" section/,
    );
    expect(() => parseContentFiles({ en, de: "# kids\n## settings\nx: y\n" }, "en")).toThrow(
      /settings belong/,
    );
    expect(() => parseContentFiles({ de }, "en")).toThrow(/missing en.md/);
  });
  it("writes settings only into the source file and skips empty languages", () => {
    const out = serializeContentFiles(
      parseContentFiles({ en, de }, "en"),
      languages.map((l) => l.code),
      "en",
    );
    expect(Object.keys(out).sort()).toEqual(["de", "en"]);
    expect(out.de).not.toContain("settings");
    expect(out.en).toContain("parent: dad");
  });
});

import { describe, expect, it } from "vitest";
import { parseContent } from "../src/parse.ts";
import { createTranslator, MissingKeyError } from "../src/translator.ts";
import { renderMarkdown, stripMarkdown } from "../src/markdown.ts";
import { validateContent } from "../src/validate.ts";

const doc = parseContent(`
# common
## settings
owner: Marc
## en
### form_name
Your name
### thanks
Thanks, {owner} will reply to {name}.
## de
### form_name
Dein Name

# kid-one
## settings
hero_name: Captain Comet
## en
### title
I am {hero_name}
### only_en
English only
## fr
### title
Je suis {hero_name}
`);

const { t, tm, setting, has } = createTranslator(doc);

describe("t()", () => {
  it("reads the page in the requested language", () => {
    expect(t("kid-one", "title", "fr")).toBe("Je suis Captain Comet");
  });
  it("falls back to common, then to the fallback language", () => {
    expect(t("kid-one", "form_name", "de")).toBe("Dein Name");
    expect(t("kid-one", "only_en", "fr")).toBe("English only");
    expect(t("kid-one", "form_name", "fr")).toBe("Your name");
  });
  it("fills placeholders from vars and settings", () => {
    expect(t("kid-one", "thanks", "en", { name: "Ana" })).toBe("Thanks, Marc will reply to Ana.");
    expect(t("kid-one", "thanks", "en")).toBe("Thanks, Marc will reply to {name}.");
  });
  it("throws for keys missing everywhere", () => {
    expect(() => t("kid-one", "nope", "en")).toThrow(MissingKeyError);
  });
  it("reads settings and checks existence", () => {
    expect(setting("kid-one", "hero_name")).toBe("Captain Comet");
    expect(setting("kid-one", "owner")).toBe("Marc");
    expect(has("kid-one", "title", "fr")).toBe(true);
    expect(has("kid-one", "only_en", "fr")).toBe(false);
  });
  it("renders Markdown and escapes HTML in values", () => {
    expect(tm("kid-one", "thanks", "en", { name: "<b>x</b>" })).toBe(
      "<p>Thanks, Marc will reply to &lt;b&gt;x&lt;/b&gt;.</p>",
    );
  });
});

describe("markdown", () => {
  it("renders bold, italic, links, lists and paragraphs", () => {
    expect(renderMarkdown("**a** *b* [c](https://x.ch)\nline\n\n- one\n- two")).toBe(
      '<p><strong>a</strong> <em>b</em> <a href="https://x.ch" rel="noopener">c</a><br>line</p><ul><li>one</li><li>two</li></ul>',
    );
  });
  it("drops unsafe link targets", () => {
    expect(renderMarkdown("[x](javascript:alert(1))", { inline: true })).not.toContain("href");
  });
  it("strips Markdown for plain text", () => {
    expect(stripMarkdown("**a** [b](https://c)")).toBe("a b (https://c)");
  });
});

describe("validateContent", () => {
  it("errors on unknown languages and pages, warns on missing keys", () => {
    const bad = parseContent("# common\n## en\n### a\nA\n## xx\n### a\nB\n# nope\n");
    const r = validateContent(bad);
    expect(r.errors.some((e) => e.includes('unknown language section "common/xx"'))).toBe(true);
    expect(r.errors.some((e) => e.includes('unknown page "nope"'))).toBe(true);
    expect(r.warnings).toContain("missing common/de/a (falls back to en)");
  });
});

describe("page inheritance (kid-one → kids → common)", () => {
  const d = parseContent(`
# common
## settings
owner: Marc
## en
### form_name
Your name

# kids
## settings
parent: dad
## en
### submit
Send to my {parent}!
### burst
POW!
## de
### submit
Schick es meinem Papa!

# kid-one
## settings
hero_name: Comet
## en
### burst
ZAP!
`);
  const tr = createTranslator(d);
  it("prefers the page, then its parent, then common", () => {
    expect(tr.t("kid-one", "burst", "en")).toBe("ZAP!");
    expect(tr.t("kid-one", "submit", "en")).toBe("Send to my dad!");
    expect(tr.t("kid-one", "form_name", "en")).toBe("Your name");
  });
  it("uses a translated parent before the English page", () => {
    expect(tr.t("kid-one", "submit", "de")).toBe("Schick es meinem Papa!");
    expect(tr.t("kid-one", "burst", "de")).toBe("ZAP!");
  });
  it("merges settings along the chain", () => {
    expect(tr.setting("kid-one", "hero_name")).toBe("Comet");
    expect(tr.setting("kid-one", "parent")).toBe("dad");
    expect(tr.setting("kid-one", "owner")).toBe("Marc");
  });
  it("does not leak child pages into the parent", () => {
    expect(tr.t("kids", "burst", "en")).toBe("POW!");
  });
});

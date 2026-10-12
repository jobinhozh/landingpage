import { describe, expect, it } from "vitest";
import { srcHash } from "../../packages/i18n/src/hash.ts";
import { parseContent } from "../../packages/i18n/src/parse.ts";
import { languages } from "../../site.config.ts";
import { applyJob, planTranslations, preservesTokens } from "./translate-plan.ts";

const h = (s: string) => srcHash(s);

const doc = () =>
  parseContent(`# kid-one
## en
### a
Hello {name}
### b
Bye
### c
Same
## de
<!-- auto src-hash:${h("old text")} -->
### a
Hallo {name}
<!-- auto src-hash:${h("Bye")} -->
### b
Tschüss
### c
Gleich (locked)
## gsw
<!-- draft src-hash:${h("old")} -->
### a
Hoi {name}

# business
## en
### x
Business only
`);

describe("translate plan", () => {
  const plan = planTranslations(doc(), languages, { "kid-one/de/c": h("Earlier source") });
  const de = plan.jobs.find((j) => j.page === "kid-one" && j.lang === "de");
  const gsw = plan.jobs.find((j) => j.page === "kid-one" && j.lang === "gsw");

  it("retranslates auto blocks whose source changed and keeps current ones", () => {
    expect(de?.items).toEqual({ a: "Hello {name}" });
  });
  it("never touches locked blocks but reports stale ones", () => {
    expect(plan.staleLocked).toEqual(["kid-one/de/c"]);
    expect(plan.lockedHashes["kid-one/de/c"]).toBe(h("Earlier source"));
  });
  it("never overwrites drafts and fills missing draft blocks with the draft marker", () => {
    expect(plan.draftsRemaining).toEqual(["kid-one/gsw/a"]);
    expect(gsw).toMatchObject({ mode: "draft", items: { b: "Bye", c: "Same" } });
  });
  it("translates the business page only into business languages", () => {
    const langs = plan.jobs.filter((j) => j.page === "business").map((j) => j.lang);
    expect(langs).toEqual(["de"]);
  });
  it("records hashes for new locked blocks", () => {
    const fresh = planTranslations(doc(), languages, {});
    expect(fresh.staleLocked).toEqual([]);
    expect(fresh.lockedHashes["kid-one/de/c"]).toBe(h("Same"));
  });
  it("writes results with markers", () => {
    const d = doc();
    expect(applyJob(d, de!, { a: "Hallo neu {name}" })).toBe(1);
    expect(d.pages["kid-one"]!.langs.de!.a).toEqual({
      text: "Hallo neu {name}",
      marker: { mode: "auto", hash: h("Hello {name}") },
    });
  });
  it("checks placeholders and links", () => {
    expect(preservesTokens("Hi {name}, see [x](https://a)", "Hoi {name}, lueg [y](https://a)")).toBe(true);
    expect(preservesTokens("Hi {name}", "Hoi {nom}")).toBe(false);
  });
});

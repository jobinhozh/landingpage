import { describe, expect, it } from "vitest";
import { detectLanguage } from "../src/detect.ts";

describe("detectLanguage", () => {
  it("maps Swiss regional tags", () => {
    expect(detectLanguage("de-CH,de;q=0.9,en;q=0.8")).toBe("gsw");
    expect(detectLanguage("fr-CH, fr;q=0.9")).toBe("fr");
    expect(detectLanguage("it-CH")).toBe("it");
  });
  it("uses the primary subtag", () => {
    expect(detectLanguage("de-DE,de;q=0.9")).toBe("de");
    expect(detectLanguage("pt-PT")).toBe("pt");
    expect(detectLanguage("zh-Hans-CN")).toBe("zh");
  });
  it("respects q values and breaks ties by config order", () => {
    expect(detectLanguage("en;q=0.5, es;q=0.9")).toBe("es");
    expect(detectLanguage("en, de")).toBe("de");
    expect(detectLanguage("en;q=0, fr;q=0.1")).toBe("fr");
  });
  it("falls back for missing or unsupported values", () => {
    expect(detectLanguage(null)).toBe("en");
    expect(detectLanguage("")).toBe("en");
    expect(detectLanguage("ja, ko;q=0.9, *;q=0.1")).toBe("en");
  });
  it("only returns available languages", () => {
    expect(detectLanguage("de-CH", ["en", "de"])).toBe("de");
    expect(detectLanguage("fr", ["en", "de"])).toBe("en");
  });
});

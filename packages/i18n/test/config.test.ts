import { describe, expect, it } from "vitest";
import { languages, personalPages, reservedSlugs } from "../../../site.config.ts";
import { themes } from "../../../themes.ts";
import { validateConfig } from "../src/validate.ts";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

describe("site.config", () => {
  it("passes config validation", () => {
    expect(validateConfig()).toEqual([]);
  });
  it("has unique, url safe page slugs", () => {
    const slugs = personalPages.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
    const langSlugs: string[] = languages.map((l) => l.slug);
    for (const s of slugs) expect(langSlugs).not.toContain(s);
    for (const s of slugs) expect(reservedSlugs as readonly string[]).not.toContain(s);
  });
});

describe("themes meet WCAG AA", () => {
  for (const [name, t] of Object.entries(themes)) {
    it(name, () => {
      expect(contrast(t.accentText, t.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast("#111111", t.bubble)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

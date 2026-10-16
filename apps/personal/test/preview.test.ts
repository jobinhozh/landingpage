import { describe, expect, it } from "vitest";
import { personalPages } from "../../../site.config.ts";
import { isPreviewBot, previewHtml, previewImageKey } from "../src/lib/preview.ts";

const kidOne = personalPages.find((p) => p.id === "kid-one")!;
const bucket = (keys: string[]) =>
  ({ list: async () => ({ objects: keys.map((key) => ({ key })) }) }) as unknown as R2Bucket;

describe("link preview", () => {
  it("knows the common preview crawlers and not browsers", () => {
    expect(isPreviewBot("WhatsApp/2.23.20.0 A")).toBe(true);
    expect(isPreviewBot("facebookexternalhit/1.1")).toBe(true);
    expect(isPreviewBot("TelegramBot (like TwitterBot)")).toBe(true);
    expect(isPreviewBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1")).toBe(false);
    expect(isPreviewBot(null)).toBe(false);
  });

  it("renders title, text and image in the page language", () => {
    const html = previewHtml({
      page: kidOne,
      lang: "de",
      url: "https://x.test/s/abc",
      image: "https://x.test/s/abc/preview",
    });
    expect(html).toContain('<meta property="og:title" content="River will wieder spielen!">');
    expect(html).toContain('og:image" content="https://x.test/s/abc/preview"');
    expect(html).toContain('<html lang="de">');
  });

  it("leaves out the image when there is none", () => {
    const html = previewHtml({ page: kidOne, lang: "en", url: "https://x.test/s/abc", image: null });
    expect(html).not.toContain("og:image");
    expect(html).toContain("River wants to play again!");
  });

  it("uses the uploaded drawing, but never an SVG", async () => {
    expect(await previewImageKey(bucket(["media/avatar-kid-one.jpeg"]), kidOne)).toBe(
      "media/avatar-kid-one.jpeg",
    );
    expect(await previewImageKey(bucket(["media/avatar-kid-one.svg"]), kidOne)).toBeNull();
    expect(await previewImageKey(bucket([]), kidOne)).toBeNull();
  });
});

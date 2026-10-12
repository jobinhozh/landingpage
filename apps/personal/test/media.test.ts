import { describe, expect, it } from "vitest";
import { findMedia, MEDIA_HEADERS, mediaType } from "../src/lib/media.ts";

function bucket(keys: string[]) {
  return {
    list: async ({ prefix }: { prefix: string }) => ({
      objects: keys.filter((k) => k.startsWith(prefix)).map((key) => ({ key })),
    }),
  } as unknown as R2Bucket;
}

describe("kid drawings and photo in R2", () => {
  it("finds an uploaded drawing in any supported format", async () => {
    expect(await findMedia(bucket(["media/avatar-kid-two.png"]), "media/avatar-kid-two")).toBe(
      "media/avatar-kid-two.png",
    );
    expect(await findMedia(bucket(["media/avatar-kid-one.svg"]), "media/avatar-kid-one")).toBe(
      "media/avatar-kid-one.svg",
    );
  });
  it("prefers webp, then png, jpg, svg when several exist", async () => {
    const b = bucket(["media/photo.jpg", "media/photo.webp", "media/photo.png"]);
    expect(await findMedia(b, "media/photo")).toBe("media/photo.webp");
  });
  it("forgives double extensions and letter case from renaming on Windows or a phone", async () => {
    expect(await findMedia(bucket(["media/avatar-kid-one.jpg.jpeg"]), "media/avatar-kid-one")).toBe(
      "media/avatar-kid-one.jpg.jpeg",
    );
    expect(await findMedia(bucket(["media/Avatar-Kid-One.JPG"]), "media/avatar-kid-one")).toBe(
      "media/Avatar-Kid-One.JPG",
    );
    expect(await findMedia(bucket(["media/avatar-kid-one.png.jpeg"]), "media/avatar-kid-one")).toBe(
      "media/avatar-kid-one.png.jpeg",
    );
    expect(mediaType("media/avatar-kid-one.png.jpeg")).toBe("image/jpeg");
  });
  it("ignores files in other folders", async () => {
    expect(
      await findMedia(
        bucket(["media/old/avatar-kid-one.png", "landingpage_folder/avatar-kid-one.png"]),
        "media/avatar-kid-one",
      ),
    ).toBeNull();
  });
  it("does not mix up pages or unsupported files", async () => {
    const b = bucket([
      "media/avatar-kid-one.png",
      "media/avatar-kid-two.gif",
      "media/avatar-kid-two-old.png",
    ]);
    expect(await findMedia(b, "media/avatar-kid-two")).toBeNull();
  });
  it("serves the right type and sandboxes it", () => {
    expect(mediaType("media/a.JPG")).toBe("image/jpeg");
    expect(mediaType("media/a.svg")).toBe("image/svg+xml");
    expect(MEDIA_HEADERS["content-security-policy"]).toContain("sandbox");
  });
});

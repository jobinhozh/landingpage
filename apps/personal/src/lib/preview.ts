import { t } from "@marc/i18n/content";
import type { PersonalPage } from "../../../../site.config.ts";
import { findMedia } from "./media.ts";

/**
 * Link previews (WhatsApp, iMessage, Telegram …). Their crawlers open the QR link without
 * cookies, so they get a small page with Open Graph tags instead of the redirect.
 * Only a valid token gets one: every other path stays the plain 404.
 */
const PREVIEW_BOTS =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|Discordbot|LinkedInBot|SkypeUriPreview|Applebot|Signal|Viber|Snapchat|redditbot|Embedly|Google-PageRenderer/i;

export const isPreviewBot = (userAgent: string | null): boolean => PREVIEW_BOTS.test(userAgent ?? "");

/** The page's picture as the preview image: the kid's drawing or Marc's photo, if one is uploaded. */
export async function previewImageKey(bucket: R2Bucket, page: PersonalPage): Promise<string | null> {
  const key = await findMedia(bucket, page.style === "comic" ? `media/avatar-${page.id}` : "media/photo");
  // Previews need a raster image, SVG is not shown.
  return key && !key.toLowerCase().endsWith(".svg") ? key : null;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function previewHtml(o: {
  page: PersonalPage;
  lang: string;
  url: string;
  image: string | null;
}): string {
  const title = esc(t(o.page.id, "preview_title", o.lang));
  const description = esc(t(o.page.id, "preview_description", o.lang));
  const meta = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${esc(o.url)}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta name="description" content="${description}">`,
    o.image ? `<meta property="og:image" content="${esc(o.image)}">` : "",
    `<meta name="twitter:card" content="${o.image ? "summary_large_image" : "summary"}">`,
  ].filter(Boolean);
  return `<!doctype html><html lang="${esc(o.lang)}"><head><meta charset="utf-8"><title>${title}</title>${meta.join("")}</head><body><p>${description}</p></body></html>`;
}

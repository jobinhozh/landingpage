import type { APIRoute } from "astro";
import { renderCv } from "../../lib/cv.ts";
import { langPaths } from "../../lib/i18n.ts";

export const getStaticPaths = langPaths;

export const GET: APIRoute = async ({ props }) => {
  const bytes = await renderCv((props as { code: string }).code);
  return new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]), {
    headers: { "content-type": "application/pdf" },
  });
};

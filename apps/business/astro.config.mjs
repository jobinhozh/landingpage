// @ts-check
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { contentCheck } from "@marc/ui/integration.ts";
import { businessLanguages, languages } from "../../site.config.ts";

// GitHub passes an unset variable as "", so treat empty like missing.
const site = process.env.BUSINESS_SITE_URL || "https://example.com";
const slugOf = (code) => languages.find((l) => l.code === code)?.slug ?? code;

export default defineConfig({
  site,
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [
    contentCheck(new URL("../../content/", import.meta.url)),
    sitemap({
      filter: (page) => !page.endsWith("/404/"),
      i18n: {
        defaultLocale: slugOf(businessLanguages[0]),
        locales: Object.fromEntries(businessLanguages.map((c) => [slugOf(c), c])),
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});

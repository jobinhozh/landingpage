// @ts-check
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { contentCheck } from "@marc/ui/integration.ts";

export default defineConfig({
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  trailingSlash: "ignore",
  security: { checkOrigin: true },
  // No Astro sessions: auth is the signed pass cookie, so no KV namespace is needed.
  session: false,
  integrations: [contentCheck(new URL("../../content/content.md", import.meta.url))],
  devToolbar: { enabled: false },
  vite: { plugins: [tailwindcss()] },
});

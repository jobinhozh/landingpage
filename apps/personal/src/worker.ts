import { handle } from "@astrojs/cloudflare/handler";
import { runScheduled } from "./lib/cron.ts";

export default {
  fetch: handle,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runScheduled(controller.cron, env));
  },
} satisfies ExportedHandler<Cloudflare.Env>;

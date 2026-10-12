/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />
/// <reference path="../../../packages/i18n/src/env.d.ts" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    ASSETS: Fetcher;
    NOTIFY: SendEmail;
    RL_IP: RateLimit;
    RL_TOKEN: RateLimit;
    TURNSTILE_SITE_KEY: string;
    NOTIFY_FROM: string;
    RESEND_FROM: string;
    ACCESS_TEAM_DOMAIN: string;
    ACCESS_AUD: string;
    NTFY_SERVER: string;
    // Secrets
    TURNSTILE_SECRET: string;
    RESEND_API_KEY?: string;
    NTFY_TOPIC?: string;
    COOKIE_SIGNING_KEY: string;
    NOTIFY_EMAIL?: string;
    OWNER_NAME?: string;
    OWNER_PHONE?: string;
    OWNER_EMAIL?: string;
    ADMIN_DEV_BYPASS?: string;
  }
}

declare namespace App {
  interface Locals {
    cfContext: ExecutionContext;
    /** Set by the middleware for requests carrying a valid page pass. */
    pass?: { page: import("../../../site.config.ts").PersonalPageId; tokenId: number; batch: string };
    admin?: { email: string };
  }
}

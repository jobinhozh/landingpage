# CLAUDE.md: marc-sites

One private monorepo, two Cloudflare Workers, one content file. Read this fully before any change. These rules override defaults.

## 1. Goal

| Site | Purpose | Access |
|---|---|---|
| `apps/business` | Marc's professional profile (SAP solutions architect, Zürich) | Public, indexed, own domain |
| `apps/personal` | Private page (Marc) + Kid 1 + Kid 2 comic pages. Kids hand QR cards to other kids so their parents can contact Marc and friendships don't get lost | QR token only, neutral `*.workers.dev`, 404 otherwise |

Hard rule: business and personal never link to each other, share no domain, no analytics ID, no visible names.

Visual reference: https://claude.ai/artifact/W5TywQwEvFSEktP1fYPuaC

## 2. Stack

- pnpm workspace monorepo
- Astro (latest stable), TypeScript strict
- Tailwind CSS v4
- Cloudflare Workers with static assets (`wrangler.jsonc`), not Pages
- `apps/personal`: Astro with Cloudflare adapter (server output) for token checks, forms, admin
- `apps/business`: Astro static output
- Storage: D1 (all personal data incl. tokens), R2 (backups)
- Turnstile (spam), Email Routing `send_email` (notifications to Marc), Resend (emails to parents), ntfy (push)
- Claude API for translation (build time only)

## 3. Repo layout

```
marc-sites/
  CLAUDE.md
  site.config.ts          # languages, order, themes refs, translate modes, tone, fallback
  themes.ts               # flag color themes
  content/content.md      # ALL user-facing text
  packages/
    i18n/                 # content.md parser, t(page, key), language detection
    ui/                   # shared components (language switcher, form, comic primitives)
  scripts/
    translate.ts
    tokens.ts             # create, revoke, list
    cards.ts              # printable QR card PDFs
    lib/                  # translate planner, card layout, D1 + arg helpers (with tests)
  apps/
    business/
    personal/
      migrations/         # D1 schema
      src/lib/crm/        # admin data layer: submissions, families, batches, broadcast (pages never write SQL)
      test/               # unit tests + CRM tests on an in-memory D1 (wrangler getPlatformProxy)
  .github/workflows/deploy.yml
  docs/                   # SETUP.md, MAINTENANCE.md (exported from the guide)
```

## 4. Languages: single source of truth

`site.config.ts` is the ONLY place languages are defined. Nothing else hardcodes a language list.

```ts
export const languages = [
  { code: "gsw", chip: "CH", slug: "ch", label: "Schwiizerdütsch", flag: "🇨🇭", theme: "switzerland", translate: "draft" },
  { code: "de",  chip: "DE", slug: "de", label: "Deutsch",         flag: "🇩🇪", theme: "germany",     translate: "auto" },
  { code: "fr",  chip: "FR", slug: "fr", label: "Français",        flag: "🇫🇷", theme: "france",      translate: "auto" },
  { code: "it",  chip: "IT", slug: "it", label: "Italiano",        flag: "🇮🇹", theme: "italy",       translate: "auto" },
  { code: "en",  chip: "EN", slug: "en", label: "English",         flag: "🇬🇧", theme: "uk",          translate: "source" },
  { code: "es",  chip: "ES", slug: "es", label: "Español",         flag: "🇪🇸", theme: "spain",       translate: "auto" },
  { code: "pt",  chip: "PT", slug: "pt", label: "Português",       flag: "🇧🇷", theme: "brazil",      translate: "auto" },
  { code: "zh",  chip: "中文", slug: "zh", label: "中文",             flag: "🇨🇳", theme: "china",       translate: "auto" },
];
export const fallback = "en";
export const businessLanguages = ["en", "de"]; // subset for the business site
export const tone = {
  business: "professional, concise; German uses formal Sie",
  private:  "warm, informal, friendly",
  kids:     "playful, very simple words a 7-year-old understands, short sentences",
};
```

Rules:
- `code` = internal language code (content.md sections, `<html lang>`, translation). `chip` = text shown in the language switcher. `slug` = URL path segment. Swiss German shows as **CH** and lives under `/ch`, while its code stays `gsw`.
- Array order = switcher order and tie-break in detection.
- Detection: `Accept-Language` first. `de-CH` → `gsw`, `fr-CH` → `fr`, `it-CH` → `it`. Unsupported → `fallback`.
- Routes, switcher, themes, sitemap, card PDFs are all generated from this array.
- Build fails if: a language lacks a theme, `fallback` is not in the array, or `businessLanguages` contains an unknown code.
- `site.config.ts` also defines `personalPages` (id, neutral slug, style, `cardLanguages`), `contentPages` (tone per page), `pageLanguages()` (business = `businessLanguages`, others = all) and `reservedSlugs`.

## 5. Themes

Flag colors per language in `themes.ts`, applied via CSS custom properties on `<html data-theme="…">`.

| Theme | bg | bubble | accent | accent text |
|---|---|---|---|---|
| brazil | #009C3B | #FFDF00 | #002776 | #FFFFFF |
| switzerland | #DA291C | #FFFFFF | #111111 | #FFFFFF |
| germany | #FFCE00 | #FFFFFF | #DD0000 | #FFFFFF |
| france | #0055A4 | #FFFFFF | #CE2B37 | #FFFFFF |
| italy | #009246 | #FFFFFF | #CE2B37 | #FFFFFF |
| uk | #012169 | #FFFFFF | #C8102E | #FFFFFF |
| spain | #AA151B | #F1BF00 | #AA151B | #FFFFFF |
| china | #EE1C25 | #FFFF00 | #B7121A | #FFFFFF |

- Flag colors for backgrounds, bursts, buttons, borders only. Body text stays dark on light panels.
- All text passes WCAG AA.
- Kids' pages: comic style is identical across themes, only the palette changes.
- Private page and business site do NOT use flag themes (own calm palettes, see reference canvas).

## 6. Content: one Markdown file

All user-facing text lives in `content/content.md`. No text hardcoded in components.

```md
# common
## en
### form_name
Your name

# kid-one
## settings
hero_name: Captain Comet
## en
### bubble
We played together! Ask your grown-up to send my dad a message, so we can play again!
## gsw
<!-- draft src-hash:ab12cd -->
### bubble
Mir händ zäme gspielt! ...
```

- Levels: `#` page (`common`, `business`, `private`, `kids`, `kid-one`, `kid-two`), `##` language code or `settings`, `###` key, body = text.
- `kids` holds the strings both kid pages share. `kid-one` and `kid-two` inherit from it (`contentPages[...].inherits` in `site.config.ts`) and only define what differs (burst word, hero facts, settings). Put a key on a kid page to override the shared one.
- Body supports multi-line Markdown (bold, italic, links) and `{placeholders}`.
- `common` = shared strings (form labels, consent, footer, privacy note).
- `settings` = untranslated values (hero names etc.).
- Typed access: `t(page, key, lang)`. Lookup chain per language: page → parent (`kids`) → `common`, first in the requested language, then in the `fallback` language.
- Missing key → fallback + build warning listing page/lang/key. Unknown language section → build error.

## 7. Translation

`npm run translate` (`scripts/translate.ts`), run locally or in CI. Never at runtime.

- English is the only manually written source.
- For each page/key and each language with mode `auto` or `draft`: translate via Claude API using `ANTHROPIC_API_KEY` and the page's tone rule.
- Write results into `content.md` under the right `## lang`, each block prefixed with a marker:
  - `auto`: `<!-- auto src-hash:<hash> -->`, retranslated when the English hash changes
  - `draft` (gsw): `<!-- draft src-hash:<hash> -->`, written once, never overwritten
- A block WITHOUT a marker is locked: never overwritten. Warn if its English source hash changed.
- Preserve Markdown and `{placeholders}` exactly.
- Output report: translated count, gsw drafts remaining, locked blocks with stale source.
- Locked blocks have no marker, so their English hash is remembered in `content/.locked-hashes.json` (committed). Delete a line there after updating a stale locked block.
- Model: `claude-opus-5-5` with structured output and server-side refusal fallback. Placeholders and link targets are verified after translation, mismatches are skipped.
- `STRICT_DRAFTS=true` → exit non-zero while gsw drafts remain.

## 8. Personal site: access by QR token

- QR cards encode `https://<project>.<neutral>.workers.dev/s/<token>`.
- One token per page per print batch (not per card). Stored in D1.
- `/s/<token>` valid → set signed HttpOnly, Secure, SameSite=Lax cookie (90 days, scoped to that page) → redirect to clean URL in detected language.
- No valid token or cookie → plain 404, identical for every path. Nothing reveals that pages exist.
- Tokens expire after 12 months by default. Revoked or expired → 404.
- `noindex` via `X-Robots-Tag` header on every response. Never list paths in `robots.txt`. Excluded from any sitemap.
- PWA manifest so parents can add the page to their home screen.
- Implementation: tokens are stored in D1 in plain form (cards must be reprintable for a batch). The cookie `__Secure-pass` is `<tokenId>.<exp>.<HMAC>` with `Path=/<slug>`, and every request re-checks that the token is still active.
- Page slugs (`site.config.ts`): private `/m`, kid-one `/k1`, kid-two `/k2`. URLs: `/<slug>/<lang-slug>`, `/<slug>/<lang-slug>/privacy`.
- Marc's photo is served from R2 key `media/photo.webp` behind the cookie (never in git, never at a public URL).

## 9. Personal pages: content and privacy

- **private:** Marc, warm personal style. Photo, short intro, chips (Zürich, languages, interests), contact form with "where did we meet".
- **kid-one / kid-two:** comic style. Bangers headings, Comic Neue body, black outlines, halftone dot background, speech bubble, POW burst, drawn avatar, hero card (superpower, favourite animal, food, loves), parent contact form with "good times to meet" chips, button "Send to my dad!".
- **Phone layout (390x844 baseline):** picture and name on ONE line at the top (round picture 64 to 80 px, name `white-space: nowrap`). Language chips, header, intro or speech bubble and the complete contact form must fit in the first screen without scrolling. Short form fields share a row (2-column grid). Kids' hero card sits below the form.
- Kids: nickname only, illustrated avatar, never photos, school, age, location or surname.
- Original designs only. No existing comic characters, logos or trademarks.
- Respect `prefers-reduced-motion`. Sound effects muted by default.
- Marc's phone and email never appear on any page.

## 10. Contact flow

1. Form fields. Private: name, phone or email, where we met, message, consent. Kids: parent name, child's first name, phone or email, good times, message, consent.
2. Turnstile + rate limit (per IP and per token).
3. Endpoint requires valid page cookie.
4. Save in D1 `submissions` with page, batch, language, timestamp.
5. Notify Marc: email via Email Routing `send_email` to verified address + push via ntfy.
6. Auto-reply to the sender (Resend) in their language: received, Marc will get in touch.

## 11. Admin and CRM (`/admin`, behind Cloudflare Access)

- Mobile-first UI.
- **Inbox:** pending submissions. Approve or reject.
- **Approve:** create or merge family (duplicate check by phone/email), log interaction, send parent Marc's vCard + WhatsApp link via Resend in their language.
- **Reject:** delete submission.
- D1 tables: `tokens`, `submissions`, `families`, `adults`, `children`, `interactions`, `reminders`, `tags`, `family_tags`.
  - families: id, source page, batch, first contact date, notes
  - adults: name, phone, email, whatsapp, language
  - children: first name, knows (kid-one, kid-two), met where
- Notes, tags, follow-up reminders (push on due date), interaction log (auto entries on approve and broadcast).
- Views: search all fields, filter by page/tag/language, "not seen in X months".
- Opt-in broadcast to approved contacts of a page (e.g. birthday invite with RSVP link).
- Batches: list with scan counts and submissions, revoke button, expiry.
- Export: vCard (single, all), CSV. Per-family data export. Delete family cascades everything.
- Manual add for people met without a card.

## 12. Scheduled jobs (cron triggers on personal Worker)

- Daily: delete unapproved submissions older than 90 days, send due reminders.
- Weekly (Sunday): export D1 to R2 as SQL, keep last 12.

## 13. Scripts

```
npm run translate
npm run token:create -- --page <page> --batch <label> [--expires 12m]
npm run token:revoke -- --page <page> --batch <label>
npm run token:list
npm run cards:pdf -- --batch <label> [--page <page>]
```

Cards PDF: A4 sheets, 10 cards per sheet, 85x55 mm, 3 mm bleed, crop marks, QR at least 20 mm with quiet zone, comic style per kid, calm style for private, "Scan me" text in the page's default languages.

## 14. Business site

- Languages: `businessLanguages` from config.
- Dark technical look (IBM Plex Sans + Mono, one accent colour), see reference canvas.
- Sections: hero (positioning, Book a call, LinkedIn), expertise (S/4HANA, Cloud ALM, CRM, AI strategy), selected work (content collection), contact.
- SEO component (title, description, Open Graph image, canonical, hreflang), sitemap, Cloudflare Web Analytics (cookieless), Cal.com embed for booking, CV PDF generated from content.
- `public/_redirects` for QR redirects: `/go https://example.com 302`.
- Impressum and privacy page (Swiss nDSG).
- Responsive: phone and desktop.

## 15. CI/CD

`.github/workflows/deploy.yml` on push to main:
1. Install, typecheck, lint.
2. `npm run translate` (commits `content.md` if changed, `[skip ci]`).
3. Build both apps.
4. `wrangler deploy` both Workers (secrets from GitHub).
5. Apply pending D1 migrations.

Dependabot for npm and GitHub Actions.

## 16. Secrets (never commit)

Personal Worker: `TURNSTILE_SECRET`, `RESEND_API_KEY`, `NTFY_TOPIC`, `COOKIE_SIGNING_KEY`, `NOTIFY_EMAIL`, `OWNER_NAME`, `OWNER_PHONE`, `OWNER_EMAIL` (the last three fill Marc's vCard and WhatsApp link, sent only by email on approve).
Personal Worker vars (`wrangler.jsonc`, not secret): `TURNSTILE_SITE_KEY`, `NOTIFY_FROM`, `RESEND_FROM`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `NTFY_SERVER`.
GitHub variables (not secret): `BUSINESS_SITE_URL`, `CF_ANALYTICS_TOKEN`. Local scripts: `PERSONAL_BASE_URL`.
GitHub: `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
Local: `.env` (gitignored), `.dev.vars` for wrangler.

## 17. Quality bar

- Lighthouse mobile ≥ 95 on all pages.
- No client JS unless needed (form, switcher, admin).
- Touch targets ≥ 44 px.
- Tests: i18n parser and inheritance, translate marker logic, token validation, cookie signing, form validation, duplicate merge, card layout, and CRM flows on a real local D1 (approve/merge, cascade delete, search filters, broadcast, RSVP, batches).
- Approve and manual add write in one D1 batch (transaction), so a failure never leaves half a family.
- Every PR keeps `npm run build` and tests green.

## 18. Working rules for Claude Code

- Propose a plan before large changes. Work in the phases of KICKOFF.md (not in the repo yet, `docs/SETUP.md` holds the manual checklist).
- Manual steps (dashboards, accounts, DNS, secrets, printing) belong to Marc. Before each phase, confirm its "before" steps are done. After each phase, print its "after" steps as a checklist and wait for confirmation. Never ask for secrets in chat.
- Never put real personal data in fixtures or commits.
- When unsure about a product decision, ask Marc instead of guessing.
- Keep this file updated when decisions change.

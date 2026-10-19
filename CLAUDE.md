# CLAUDE.md: marc-sites

One private monorepo, two Cloudflare Workers, one content file. Read this fully before any change. These rules override defaults.

## 1. Goal

| Site | Purpose | Access |
|---|---|---|
| `apps/business` | Marc's professional profile (software engineering leader, Zürich) | Public, indexed, own domain |
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
  content/<lang>.md       # ALL user-facing text: en.md hand-written, de.md, gsw.md, … translated
  packages/
    i18n/                 # content parser (one file per language), t(page, key), language detection
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
- `code` = internal language code (content file name `content/<code>.md`, its `## <code>` sections, `<html lang>`, translation). `chip` = text shown in the language switcher. `slug` = URL path segment. Swiss German shows as **CH** and lives under `/ch`, while its code stays `gsw`.
- Array order = switcher order and tie-break in detection.
- Detection: `Accept-Language` first. `de-CH` → `gsw`, `fr-CH` → `fr`, `it-CH` → `it`. Unsupported → `fallback`.
- Routes, switcher, themes, sitemap, card PDFs are all generated from this array.
- Build fails if: a language lacks a theme, `fallback` is not in the array, or `businessLanguages` contains an unknown code.
- `site.config.ts` also defines `personalPages` (id, neutral slug, style, `cardLanguages`), `contentPages` (tone per page), `pageLanguages()` (business = `businessLanguages`, private = `privateLanguages`: gsw, de, en, fr, pt, es, kids = all) and `reservedSlugs`.

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
- Kids' pages: comic style is identical across themes, only the palette and the flag change. Country look: a flag ribbon across the top, a flag strip on top of the form, and the language switcher shows each language as its country's flag (34x23 inside a 44x44 button, language name as accessible label). Flags are drawn in `flags.ts` (one builder per theme; every language's theme needs one, a test checks it).
- Private page: grown-up graphic novel (warm paper #F3EEE4 with halftone, ink #141414, Anton headings). Accent and caption colour follow the selected language (`privateThemes` in `themes.ts`, e.g. DE red + gold, FR blue + pale red, PT green + yellow), accents pass WCAG AA with white text. Business: dark technical (see reference canvas), no flag themes.

## 6. Content: one Markdown file per language

All user-facing text lives in `content/<code>.md`, one file per language. `content/en.md` is the only hand-written file and also holds every `## settings` section; `de.md`, `gsw.md`, `fr.md` … hold only translations. Each file uses the same format below and contains only its own `## <code>` sections. A language file may be missing (everything falls back to English). No text hardcoded in components.

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
- Write results into `content/<lang>.md` under the right `## lang`, each block prefixed with a marker:
  - `auto`: `<!-- auto src-hash:<hash> -->`, retranslated when the English hash changes
  - `draft` (gsw): `<!-- draft src-hash:<hash> -->`, written once, never overwritten
- A block WITHOUT a marker is locked: never overwritten. Warn if its English source hash changed.
- Preserve Markdown and `{placeholders}` exactly.
- Output report: translated count, gsw drafts remaining, locked blocks with stale source.
- Locked blocks have no marker, so their English hash is remembered in `content/.locked-hashes.json` (committed). Delete a line there after updating a stale locked block.
- Model: `claude-opus-5-5` with structured output and server-side refusal fallback. Placeholders and link targets are verified after translation, mismatches are skipped.
- `STRICT_DRAFTS=true` → exit non-zero while gsw drafts remain.

## 8. Personal site: access by QR token

- QR cards encode `https://<project>.<neutral>.workers.dev/s/<token>`. The personal Worker is named `hello` (database stays `marc-personal`, it is never visible). The business Worker keeps `marc-business`, since that site is public under Marc's name anyway.
- One token per page per print batch (not per card). Stored in D1.
- `/s/<token>` valid → set signed HttpOnly, Secure, SameSite=Lax cookie (90 days, scoped to that page) → redirect to clean URL in detected language.
- No valid token or cookie → plain 404, identical for every path. Nothing reveals that pages exist.
- Tokens expire after 12 months by default. Revoked or expired → 404.
- `noindex` via `X-Robots-Tag` header on every response. Never list paths in `robots.txt`. Excluded from any sitemap.
- PWA manifest so parents can add the page to their home screen.
- Link previews (WhatsApp, iMessage, Telegram …): `/s/<token>` answers known preview crawlers with an Open Graph card (`preview_title`, `preview_description`, image = the uploaded drawing or photo via `/s/<token>/preview`) instead of the redirect. No cookie, no scan count. Invalid tokens stay 404.
- Implementation: tokens are stored in D1 in plain form (cards must be reprintable for a batch). The cookie `__Secure-pass` is `<tokenId>.<exp>.<HMAC>` with `Path=/<slug>`, and every request re-checks that the token is still active.
- Page slugs (`site.config.ts`): private `/m`, kid-one `/k1`, kid-two `/k2`. URLs: `/<slug>/<lang-slug>`, `/<slug>/<lang-slug>/privacy`.
- Marc's photo is served from R2 key `media/photo.<webp|png|jpg>` behind the cookie (never in git, never at a public URL).
- A kid's own drawing can replace the built-in avatar: R2 key `media/avatar-<page>.<webp|png|jpg|svg>`, served at `/<slug>/avatar` behind the cookie and sandboxed by CSP. Without an upload the built-in drawn avatar (`avatar` setting) is used. Drawings only, never photos.

## 9. Personal pages: content and privacy

- **Photo puzzle (private page and business hero):** `@marc/ui/PhotoPuzzle.astro`. The picture looks normal; a tap opens a 3x3 sliding puzzle in a dialog (88 px tiles, always solvable), solved shows the whole picture. Texts `common/puzzle_*`. Business picture: `apps/business/src/assets/profile.<jpg|jpeg|png|webp>` (public, in git); without it the hero has no picture.
- **private:** Marc, comic style for adults (graphic novel). Photo, intro as a narration box with "Based in Zürich. Home worldwide." below it. Language switcher shows Marc's level under each language (`level_<code>` settings, `native` translated via `level_native`); other languages redirect to the best published one. No interest chips (removed). Contact form with "where did we meet". Below the form a hero card ("Marc's file") holds a dotted world map of the visited countries (`src/data/travel.json`, map generated by `npm run map` into `src/data/world-map.ts`, small countries as pins) and a sport table with the best result per category (`src/data/sport.json`: `best` time or `rank`, rank shown as `#98,372` in the page language's number format; labels `sport_*`). Both blocks are hidden by default; `?show=travel`, `?show=sport` or `?show=travel,sport` adds them. It also works on the QR link (`/s/<token>?show=…`) and survives language switches and the form.
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

Without a local setup: GitHub Actions → **QR cards** → Run workflow (page, batch, expiry). It creates or reuses the token (`--reuse`) and offers the card PDF plus a QR PNG as a download for 1 day. Tokens are masked in the logs.

Cards PDF: A4 sheets, 10 cards per sheet, 85x55 mm, 3 mm bleed, crop marks, QR at least 20 mm with quiet zone, comic style per kid, calm style for private, "Scan me" text in the page's default languages.

## 14. Business site

- Languages: `businessLanguages` from config.
- Dark technical look (IBM Plex Sans + Mono, one accent colour), see reference canvas.
- Sections: hero (positioning, Book a call, LinkedIn), focus areas (agent-led development, engineering process, architecture, domain knowledge; keys still `exp_s4/alm/crm/ai`), certifications (`src/data/certifications.json`: name, issuer, optional year and url, `tags` for the filter buttons SAP / AI / Project management; also in the CV), selected work (`src/data/work.json` holds id and year, industry/title/text are content keys), contact.
- SEO component (title, description, Open Graph image, canonical, hreflang), sitemap, Cloudflare Web Analytics (cookieless), Cal.com embed for booking, CV PDF generated from content.
- `public/_redirects` for QR redirects: `/go https://example.com 302`.
- Impressum and privacy page (Swiss nDSG).
- Responsive: phone and desktop.

## 15. CI/CD

`.github/workflows/deploy.yml` on push to main:
1. Install, typecheck, lint.
2. `npm run translate` (commits changed `content/*.md` files, `[skip ci]`; skipped while `ANTHROPIC_API_KEY` is unset).
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

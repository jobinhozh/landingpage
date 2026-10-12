# Setup: Marc's manual steps

Everything in code is done. These steps need Marc's accounts, so Claude never does them. Work top to bottom and tick each box.

## 1. Accounts and repository

- [ ] Cloudflare account with Workers, D1, R2 and Email Routing enabled
- [ ] Resend account with a verified sending domain
- [ ] ntfy app on the phone, subscribed to a long random topic name
- [ ] Anthropic API key for translations (optional at first: without it CI skips translation and pages show English)
- [ ] Repository is private on GitHub

## 2. Cloudflare resources

Run from `apps/personal`:

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create marc-personal      # already done, id is in wrangler.jsonc
pnpm exec wrangler r2 bucket create landingpage   # already done
pnpm exec wrangler d1 migrations apply marc-personal --remote
```

- [x] Workers subdomain is neutral: `hellolandingpage`. It is printed on every QR card, never change it after printing.
- [ ] The personal Worker is called `hello`, so cards show `hello.hellolandingpage.workers.dev`. Change `name` in `apps/personal/wrangler.jsonc` only before printing cards, because old cards would break.
- [ ] Upload the photo: `pnpm exec wrangler r2 object put landingpage/media/photo.webp --file photo.webp --remote` (or R2 → `landingpage` → Upload in the dashboard)
- [ ] Optional: the kids' own drawings as `media/avatar-kid-one.png` and `media/avatar-kid-two.png` (see docs/MAINTENANCE.md)

## 3. Email

- [ ] Email Routing on a domain Marc owns, with Marc's address verified as destination
- [ ] Set `NOTIFY_FROM` in `apps/personal/wrangler.jsonc` to an address on that domain
- [ ] Set `RESEND_FROM` to the verified Resend sender

## 4. Spam and admin protection

- [ ] Turnstile widget for the workers.dev hostname. Put the site key in `TURNSTILE_SITE_KEY`.
- [ ] Cloudflare Access application for `hello.hellolandingpage.workers.dev/admin*`, allowing only Marc's email
- [ ] Copy the team domain and the application AUD tag into `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`

## 5. Secrets

Personal Worker (`pnpm exec wrangler secret put <NAME>` in `apps/personal`):

- [ ] `TURNSTILE_SECRET`
- [ ] `COOKIE_SIGNING_KEY` (generate with `openssl rand -base64 32`)
- [ ] `RESEND_API_KEY`
- [ ] `NTFY_TOPIC`
- [ ] `NOTIFY_EMAIL`
- [ ] `OWNER_NAME`, `OWNER_PHONE`, `OWNER_EMAIL`

GitHub (Settings → Secrets and variables → Actions):

- [ ] Secrets: `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN` (Workers, D1 edit), `CLOUDFLARE_ACCOUNT_ID`
- [ ] Variables: `BUSINESS_SITE_URL` (e.g. `https://example.com`), `CF_ANALYTICS_TOKEN`
- [ ] Environment `production` exists (the deploy job uses it)

## 6. Business domain

- [ ] Add the custom domain route in `apps/business/wrangler.jsonc` (commented example there)
- [ ] Cloudflare Web Analytics site created, token stored as `CF_ANALYTICS_TOKEN`
- [ ] Cal.com event created, handle set in `content/content.md` → `# business` → `cal_link`

## 7. Content

- [ ] Replace every `[placeholder]` in `content/content.md` (English only)
- [ ] Kids' hero card facts and nicknames (`hero_name`): nicknames only, never real names
- [ ] Push to `main`. CI translates, builds, migrates and deploys.
- [ ] Review the Swiss German drafts (`<!-- draft … -->`), then delete each marker once a block is good

## 8. First cards

```sh
cp .env.example .env   # set PERSONAL_BASE_URL
npm run token:create -- --page kid-one --batch 2026-autumn
npm run cards:pdf -- --batch 2026-autumn --page kid-one
```

- [ ] Scan a printed card with a phone, check the page, send a test message, approve it in `/admin`

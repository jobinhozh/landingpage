# Maintenance

Day to day, Marc only edits English text and prints cards. Everything else runs on its own.

## Change text

1. Edit the `## en` block in `content/content.md`.
2. Push to `main`. CI retranslates every `auto` block whose English changed.
3. Locked blocks (no marker) are never overwritten. The translate report lists them when their English changed.

## Cards

| Task | Command |
|---|---|
| New batch | `npm run token:create -- --page <page> --batch <label> [--expires 12m]` |
| Print | `npm run cards:pdf -- --batch <label> [--page <page>]` → `cards/` |
| Revoke | `npm run token:revoke -- --page <page> --batch <label>` or the Batches screen in `/admin` |
| Overview | `npm run token:list` |

Add `--local` to work against the local D1 in development.

## Contacts

- `/admin`: approve or reject new messages. Unapproved ones are deleted after 90 days.
- People: search, tags, notes, reminders (push on the due date), interaction log, exports.
- Delete a family when asked: it removes everything linked to it.

## Backups

Every Sunday the Worker writes `backups/d1-<date>.sql` to R2 and keeps the last 12. Restore:

```sh
pnpm exec wrangler r2 object get marc-personal/backups/d1-<date>.sql --file restore.sql --remote
pnpm exec wrangler d1 execute marc-personal --remote --file restore.sql
```

## Local development

```sh
pnpm install
cp apps/personal/.dev.vars.example apps/personal/.dev.vars
pnpm --filter personal db:migrate:local
pnpm dev:personal     # http://localhost:4321, /admin works on localhost only
pnpm dev:business
pnpm test && pnpm lint && pnpm typecheck && pnpm build
```

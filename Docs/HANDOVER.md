# HANDOVER.md — Proof of Post (build-fable)

Updated at each release. What's done, what was learned, how it works, known issues.

## Status (8 Nov 2026, pre-release)

**Done**
- App skeleton (Next.js 16.4, app router, TypeScript, Tailwind 4), port 3002.
- Database schema and driver switch (PGlite locally, Postgres on Render), first migration.
- Platform adapter interface with a verified Bluesky adapter and a manual fallback adapter.
- Fee quote maths.

**Blocked / waiting on the owner**
- PayPal sandbox credentials (own app for this build). Chrome is not signed in to the developer dashboard.
- Anthropic API key, YouTube Data API key, Twitch client id/secret.
- Which YouTube video, Twitch channel and Bluesky account to use for the demo.

## How it works (so far)

```
src/lib/db/schema.ts      Drizzle pg-core schema + the JSON shapes (DealTerms, Verdict)
src/lib/db/index.ts       getDb(): picks PGlite or node-postgres, runs migrations on first use
src/lib/platforms/        PlatformAdapter { resolve, fetch, stillLive }; bluesky.ts, manual.ts, index.ts
src/lib/money.ts          quote(priceCents, tier) → platform fee, PayPal estimate, brand total
scripts/spike-*.ts        Day-1 verification scripts (run with `pnpm tsx scripts/<name>.ts`)
```

Money is integer cents. The creator always receives the agreed price. The brand total is grossed up so that after PayPal's processing fee the net equals price + platform fee.

## Known issues
- None recorded yet beyond the blocked items above.

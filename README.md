# Proof of Post

Brand deals that pay the creator automatically once AI has verified the post. The money is held by PayPal.

Built for the PayPal AI Hackathon (Nov 2026). This is the **build-fable** entry (Claude Fable 5.1 as the builder; Claude Opus 5.5 inside the app).

> Status: early skeleton. See `Docs/LOG.md` for what is verified and `Docs/HANDOVER.md` for the current state.

## What it does

1. Brand and creator agree a deal in a plain-English chat. Claude turns it into fixed terms both sides accept.
2. The brand pays through PayPal checkout with the creator as the seller. PayPal holds the funds; our fee is split off.
3. The creator posts and pastes the link. We fetch the post from the platform and Claude compares it with the terms: pass or fail, with plain-English reasons and quoted evidence.
4. Daily re-checks for the agreed stay-up period.
5. Pass: PayPal releases the money, either at go-live or after the stay-up period. Fail: fix window, then the brand is refunded.

## Run locally

```bash
pnpm install
cp .env.example .env.local      # fill in the values (names only are listed there)
pnpm dev                        # http://localhost:3002
```

No database setup is needed locally: with `DATABASE_URL` empty the app uses an embedded Postgres (PGlite) under `./data/`. Set `DATABASE_URL` to use a real Postgres (Render in production).

## Environment variables (names only)

See `.env.example`. PayPal sandbox credentials, an Anthropic API key, a YouTube Data API key and Twitch client credentials.

## PayPal sandbox setup

*To be written once the multiparty spike is done. Which approach is in use (multiparty with delayed disbursement, or the Payouts fallback) will be stated here honestly.*

## Architecture

```
Deal builder (AI) → Deal terms (JSON, both accept) → PayPal order (creator as seller, platform fee, delayed disbursement)
   → creator posts → Checker: platform adapter → AI verdict (pass/fail + reasons + evidence)
   → daily re-checks → release (or refund) through PayPal → audit log + dashboards
```

- `src/lib/db` Drizzle schema and driver switch (PGlite / Postgres)
- `src/lib/platforms` adapters behind one interface: Bluesky (verified), manual fallback; YouTube and Twitch to come
- `src/lib/money.ts` fee maths
- `src/lib/paypal` PayPal client (to come)
- `src/lib/ai` Claude deal builder and checker (to come)

## What's real and what's faked

Updated honestly as the build progresses. Right now: Bluesky fetching is real; nothing else is wired yet.

## Licence

AGPL-3.0. See `LICENSE`.

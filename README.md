# Proof of Post

Brand deals that pay the creator automatically once AI has verified the post. The money is held by PayPal until then.

Built for the PayPal AI Hackathon (Nov 2026). Built with Claude Fable 5.2 as the coding agent; Claude Opus 5.5 and Haiku 5.5 run inside the app.

> Hosted demo: https://proof-of-post-fable.onrender.com (Render free tier: the first load after a quiet spell takes up to a minute while it wakes up).
> Demo video (2:49): https://youtu.be/RUmNq-PfbOM
> Judges: to try a payment on the hosted demo, use the sandbox buyer login under [Try it as a judge](#try-it-as-a-judge).
> What is verified and what is not: `Docs/LOG.md` (running log) and `Docs/CHECKPOINT.md` (scorecard with proof).

## What it does

1. **Agree.** Brand and creator talk in plain English. Claude turns the chat into fixed terms (platform, account, deliverable, deadline, stay-up days, required #ad / mentions / links, price, when the creator is paid). Both sides accept; any edit voids the acceptances.
2. **Pay.** The brand pays through PayPal checkout. The order is a PayPal multiparty order with the creator as the seller, our fee split off as a platform fee, and **delayed disbursement**: PayPal holds the money, we never touch it.
3. **Post.** The creator pastes the link. We fetch the post from the platform (Bluesky, YouTube, Twitch, or a manual screenshot fallback) and Claude compares it with the terms: pass, fail or needs review, with plain-English reasons and quoted evidence. Caption text is treated as untrusted; a caption that tries to talk to the checker is flagged.
4. **Watch.** Daily re-checks for the agreed stay-up period catch a deleted or edited post. Re-checks only call the model when the post changed.
5. **Settle.** Pass: PayPal releases the held funds to the creator, either when the post is verified or after the stay-up period (the deal says which). Fail: a 48-hour fix window, then the brand is refunded in full, our fee included.

## Run locally

```bash
pnpm install
cp .env.example .env.local      # fill in the values; the names are listed below
pnpm dev                        # http://localhost:3002
```

No database setup is needed locally: with `DATABASE_URL` empty the app uses an embedded Postgres (PGlite) under `./data/`. Set `DATABASE_URL` to use a real Postgres (Render in production). Migrations run on start.

Demo data: a demo brand and a demo creator are created on first use. Open http://localhost:3002/deals and click **New deal**.

Driving a whole deal from the command line (creates a deal, runs one AI deal-builder turn, sets terms, accepts both sides, creates the PayPal order, then post / time-warp / re-check):

```bash
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/e2e-sandbox.ts setup
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/e2e-sandbox.ts post <dealId> <postUrl>
node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/e2e-sandbox.ts warp <dealId> 7
```

## Environment variables (names only)

| Name | What |
|---|---|
| `PAYPAL_ENV` | `sandbox` or `live` |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | the **Platform**-type sandbox app's REST credentials |
| `PAYPAL_PLATFORM_MERCHANT_ID` | our own sandbox business account's merchant id (used for seller-onboarding lookups) |
| `PAYPAL_BN_CODE` | optional partner attribution id |
| `PAYPAL_WEBHOOK_ID` | optional; only needed once the app has a public URL |
| `ANTHROPIC_API_KEY` | Claude |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` | Twitch Helix app credentials |
| `ADMIN_TOKEN` | protects the demo clock and the cron route |
| `APP_URL` | public base URL used in PayPal return links (`http://localhost:3002` locally) |
| `DATABASE_URL` | empty locally (PGlite); Postgres URL on Render |

## PayPal sandbox setup

What is in use: **PayPal multiparty (Commerce Platform) with delayed disbursement**, not Payouts. Steps that were needed:

1. developer.paypal.com → Apps & Credentials → create a sandbox app of type **Platform** (this is what unlocks the multiparty endpoints; a Merchant-type app gets 401s). Tick **Platform fee** and **Delay disbursement**; onboarding intent Business. Accept the developer agreement.
2. Copy the client id / secret into `.env.local`. Note the auto-created business account's merchant id (it also appears as `platform_fees[].payee.merchant_id` on any order you create) → `PAYPAL_PLATFORM_MERCHANT_ID`.
3. Testing Tools → Sandbox Accounts: create a US **personal** account (the brand / buyer) and a US **business** account (the creator / seller).
4. The creator must complete **partner-referral onboarding** once (Creator page → *Connect PayPal*; log in as the seller). Linking by email is not enough: capture returns `PAYEE_NOT_CONSENTED` until the seller has consented to the platform. The app verifies onboarding with PayPal by tracking id rather than trusting the redirect.
5. When paying, the browser must be logged in as the **buyer**, not the seller (PayPal refuses to let a seller pay their own order).

Facts verified in the sandbox, 8–12 Nov 2026: order creation with `payee`, `platform_fees` and `disbursement_mode: DELAYED`; capture (COMPLETED, DELAYED, fee breakdown exact); full release via `POST /v1/payments/referenced-payouts-items` (SUCCESS, synchronous); refund of the undisbursed capture (COMPLETED, platform fee returned with it). Partial release with `payout_amount` is rejected (`AMOUNT_CHECK_FAILED`), which is why payouts are single-stage. Sending `payment_instruction.platform_fees` on the refund is rejected (`PLATFORM_FEE_NOT_ENABLED`) and is not needed.

## Try it as a judge

The hosted demo needs no keys and no setup: https://proof-of-post-fable.onrender.com

**Without logging in to anything** you can start a deal in the chat and watch Claude build the terms, open the brand dashboard, and open any finished deal to see its PayPal order and capture ids, the AI verdict with its evidence, and the audit log.

**To pay for a deal**, use this PayPal sandbox buyer at the PayPal checkout. It is a test account made for judges and holds test money only.

| | |
|---|---|
| Email | `sb-ooh47x53883773@personal.example.com` |
| Password | `qNLK+4HV` |

A full run, about three minutes:

1. Home page → **Start a deal**. In the chat, type a deal, for example: *One YouTube video from @alex-v7l8b about our new oat-milk chai. Must include #ad and #NimbusTea in the description. Up by 20 Nov 2026, stays up 7 days, $250, paid in full when the post is verified.*
2. Click **Accept as brand**, then **Accept as creator**.
3. Click **Pay with PayPal (sandbox)** and log in with the buyer above. PayPal now holds the money.
4. Paste one of these public test videos as the post link and submit:
   - `https://youtu.be/xVjRmNjas7U` meets the terms: pass, and PayPal releases the creator's money.
   - `https://youtu.be/LNKXA1Au5h8` has no paid-promotion label: fail, 48-hour fix window, then a full refund.
   - `https://youtu.be/iWTZzlIeJ3g` has a description that tells the checker to approve it: flagged and failed.

The demo creator is already linked to an onboarded sandbox seller (`sb-ihmpl53787724@business.example.com`), so no seller login is needed. The demo clock that fast-forwards a deal needs the admin token and is shown in the demo video instead.

If the buyer login does not work, contact us through Devpost and we will send a fresh one. The demo video shows a full payment, release and refund.

The app itself has no login: pick a side on the home page. The admin page is read-only.

## Architecture

```
Deal builder (Claude) → terms JSON, both accept → PayPal multiparty order (creator = seller, platform fee, DELAYED)
   → buyer approves → capture (PayPal holds) → creator posts → adapter fetches → Claude verdict (evidence + reasons)
   → daily re-checks (code first; model only if the post changed) → referenced payout (release) or refund
   → audit log on every step → brand AG Grid dashboard, creator page, admin review queue
```

| Where | What |
|---|---|
| `src/lib/db` | Drizzle schema (brands, creators, deals, payments, posts, checks, audit events) and the PGlite / Postgres driver switch |
| `src/lib/deals.ts` | deal state machine (`TRANSITIONS`), terms, acceptances, per-deal demo clock |
| `src/lib/paypal` | REST client, `multiparty.ts` (partner referral, orders, capture, referenced payout, refund, merchant lookups) |
| `src/lib/payments.ts` | money movement on top of PayPal: checkout, capture, release, refund, close-failed-deal; every step audited |
| `src/lib/platforms` | one adapter interface; Bluesky (public AppView), YouTube (Data API v3, paid-promotion flag), Twitch (Helix, branded-content flag), manual |
| `src/lib/ai` | Claude deal builder and post checker (structured output, adaptive thinking, untrusted-content block, injection flag) |
| `src/lib/checker.ts` | check orchestrator: snapshot, code-first diff on re-checks, verdict → status |
| `src/app/api` | deals, chat, terms, accept, pay, post, recheck, cron, admin clock, creator onboarding, PayPal webhook |
| `src/app` | home, deals list, deal page (chat, terms, money, checks, audit), creator page, brand dashboard (AG Grid), pricing, admin |
| `scripts/` | sandbox drivers and probes (`e2e-sandbox.ts`, `spike-verdict.ts`, `spike-adapters.ts`, `probe-*.ts`) |

## What's real and what's faked

**Real**

- PayPal: sandbox multiparty end to end. Order → capture (held) → release, and order → capture → refund, both run against the sandbox API with real sandbox buyer/seller accounts.
- Claude: every verdict and every deal-builder turn is a live model call. No canned verdicts.
- Bluesky, YouTube and Twitch fetching: live API calls; the YouTube paid-promotion flag and Twitch branded-content flag feed the disclosure check.
- Daily re-checks and the fix-window / refund logic run through the same code the cron route uses.

**Demo shortcuts (stated honestly)**

- **Demo clock.** Deals have a per-deal day offset so a 7-day stay-up period can be shown in a minute. Real time is used unless an admin jumps the clock.
- **No accounts.** One demo brand and one demo creator; you pick a side. Real onboarding, auth and KYC are out of scope.
- **Manual adapter** (screenshot + pasted text) is a lower-trust fallback for platforms we do not fetch; the verdict says so.
- **PayPal webhook** route exists but is unverified. The app does not depend on it: capture, release and refund are confirmed from the API responses, and a PENDING capture is re-polled by the re-check job.
- **Partially released** deals cannot occur: PayPal rejects partial referenced payouts, so payouts are single-stage (100% when verified or 100% after stay-up).
- If a creator has already been paid and the post later disappears, nothing is clawed back automatically; the deal is marked *Under review* for a human.

## Licence

AGPL-3.0. See `LICENSE`.

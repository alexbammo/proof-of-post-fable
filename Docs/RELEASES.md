# Releases — Proof of Post (build-fable)

Every deploy gets a number. Newest first.

## 0.1, 11 Nov 2026: first Render deploy

https://proof-of-post-fable.onrender.com from commit `87269e6` via the `render.yaml` Blueprint (web service, free Postgres, daily cron). Contents:

- Next.js 16 skeleton, Drizzle schema (brands, creators, deals, payments, posts, checks, audit events, disputes, chat), PGlite/Postgres driver switch.
- Platform adapters behind one interface: Bluesky, YouTube, Twitch (all verified against live content), manual fallback.
- Fee maths (gross-up so the creator receives exactly the agreed price).
- PayPal multiparty: partner-referral onboarding (verified by tracking id), DELAYED platform order, capture, full release by referenced payout, refund. Pay → hold → check → release and pay → fail → fix window → refund both verified in the sandbox (deals `deal_pdtv33wwpu`, `deal_duttwg7d77`).
- Claude deal builder and post checker (structured output, evidence, injection flag); re-checks code-first, Haiku only on change.
- Deal state machine, audit log, demo clock, cron re-check route, admin review queue.
- UI: home, deals, deal page (chat, terms, money, checks, audit), creator, brand AG Grid dashboard, pricing, admin.
- Single-stage payouts only (owner decision 8 Nov); a failed deal whose creator was already paid goes to *Under review*, never a clawback.
- Docs: LOG, RELEASES, HANDOVER, CHECKPOINT, DEVPOST, README. AGPL-3.0 licence.

# Devpost submission draft — Proof of Post

*Draft. Updated as the build progresses. Final text goes on Devpost on Thu 12 Nov with the owner's yes.*

## Inspiration / the problem

Brands pay creators and sometimes the post never appears, goes up without the #ad label, or is deleted after a day. Creators deliver and then chase payment for weeks. Today a person checks everything by hand with screenshots, or a marketplace takes 10–15% from each side. The average creator deal is about $250, and 80% are under $300, so nobody can afford a human in the loop.

## What it does

Proof of Post is brand-deal escrow where AI does the checking and PayPal holds the money.

1. Brand and creator agree the deal in plain English in a chat. Claude turns it into fixed terms: platform, account, deadline, required mentions, links and hashtags, the #ad label, how many days the post must stay up, price and payout split. Both sides accept.
2. The brand pays through PayPal checkout with the creator as the seller. PayPal holds the funds; our fee is split off automatically.
3. The creator posts and pastes the link. We fetch the post from the platform (text, tags, thumbnail, disclosure flags) and Claude compares it with the terms, returning pass or fail with plain-English reasons and quoted evidence.
4. Daily re-checks until the stay-up period ends. Plain code first; a small model only when something changed.
5. On a pass PayPal releases the money to the creator, either at go-live or after the agreed stay-up period. On a fail the creator gets a fix window, then the brand is refunded.
6. Brands get a campaign dashboard (AG Grid); creators see deals and payouts; every decision is in an audit log.

## How we built it

Next.js 16 + TypeScript, Postgres (Render) via Drizzle, PayPal sandbox (Orders v2, multiparty/delayed disbursement or Payouts fallback, webhooks), Claude Opus 5.5 with structured outputs and image input for the deal builder and the main check, Claude Haiku 5.5 for changed re-checks, AG Grid Community for the brand dashboard, hosted on Render.

## Challenges

- *To be filled from LOG.md.*

## What's next

Instagram and TikTok adapters (their app reviews take weeks), enterprise #ad compliance reports, mass payouts.

## Built with

TypeScript, Next.js, Postgres, Drizzle, PayPal REST APIs (sandbox), Anthropic Claude API, AG Grid, Render.

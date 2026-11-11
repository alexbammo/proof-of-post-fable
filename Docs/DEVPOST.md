# Devpost submission draft — Proof of Post

*Draft. Updated as the build progresses. Final text goes on Devpost on Thu 12 Nov with the owner's yes.*

## Inspiration / the problem

Brands pay creators and sometimes the post never appears, goes up without the #ad label, or is deleted after a day. Creators deliver and then chase payment for weeks. Brands and agencies typically pay 60 to 90 days after delivery. Today a person checks everything by hand with screenshots, a marketplace takes a cut and still needs someone to approve the release, or a manager takes 15 to 20%. The average paid deal is about $255 on video and under $200 on photo platforms, and 80% are under $300 (Collabstr 2026 report, 21,000 collaborations), so nobody can afford a human in the loop.

Others have automated the check, but they pay in crypto tokens. The mainstream marketplaces pay real money but release it on a person's say-so or a timer. We wanted the automated check in front of real money.

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

- **PayPal multiparty rules are learned by hitting them.** A Merchant-type app gets 401s on the platform endpoints; a seller who has not been through onboarding gives 403 PAYEE_NOT_CONSENTED at capture; a partial release of a held capture is refused (422 AMOUNT_CHECK_FAILED), which is why payouts are single-stage; a refund that names the platform fee is refused (422 PLATFORM_FEE_NOT_ENABLED), and it turned out not to be needed because the held gross already contains the fee.
- **A bug the hosted run found.** A creator linked by email only could be paid but not refunded (403), because the refund is a seller-scoped call and needs the seller's merchant id. The id is on the capture, not on the order. Fixed and verified on the live site the same evening.
- **Refunds must never claw back from a paid creator.** A review caught that a deal paid at go-live and later failing would have refunded against money already disbursed. Those deals now go to a person instead.
- **Making the checker hard to talk round.** Caption text is treated as untrusted data; a caption that addresses the checker is flagged and cannot produce a pass.
- **Keeping re-checks cheap.** Daily re-checks compare a snapshot in plain code and only call a model when the post changed.

## What's next

Instagram and TikTok adapters (their app reviews take weeks), staged payouts for longer campaigns (needs a second PayPal capture per stage), enterprise #ad compliance reports, mass payouts.

## Built with

TypeScript, Next.js, Postgres, Drizzle, PayPal REST APIs (sandbox), Anthropic Claude API, AG Grid, Render.

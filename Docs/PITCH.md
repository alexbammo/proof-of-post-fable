# Pitch notes: Proof of Post

Written 11 Nov 2026. Feeds the Devpost text, the video and the README. Web research was done on 11 Nov through search summaries; primary pages were not opened, so each figure carries a confidence note. Check a figure at its source before it goes on Devpost.

## Has anyone else done this?

Parts of it, yes. The whole thing, not that I could find. Do not say "first" or "only".

| Who | What they do | How we differ |
|---|---|---|
| HumanAds | Checks a post against requirements (links, hashtags, disclosure) and a smart contract pays out. | Crypto wallets and tokens, not real money. No stay-up re-checks. |
| Tunnl (a Circle partner) | AI checks content against the brief, releases USDC automatically. | Stablecoin only; the creator needs a wallet. |
| FluxPay, FlowBack, Chainfluence, B4B | Hackathon and web3 projects: USDC locked in a contract, released on AI or oracle verification (B4B on advertiser approval). | Crypto only; mostly entries, not products. |
| ChainReach | Site claims AI verification of platform, hashtags, timing and engagement, with automatic payment. | Closest claim to ours. Payment rail not confirmed (the name suggests crypto). Vendor page only, no independent evidence. |
| Collabstr, Ainfluencer, Bioby.ai, HyypeUp | Hold the brand's money in ordinary currency and pay the creator. | A person approves the release. |
| Mega Donkey | Brand confirms the post is live; auto-release after 7 days if the brand does nothing. | A timer, not a check of the post. |

**Where we sit:** the crypto projects automate the check but pay in tokens most small brands and creators do not use. The mainstream marketplaces pay real money but rely on a person or a timer. Proof of Post puts an AI check with quoted evidence in front of real money held by PayPal, and keeps checking for the agreed stay-up period.

## Why this works

- **Neither side has to trust the other.** The brand's money is committed before the creator does the work, and it cannot be released until the post is proven.
- **We never hold the money.** PayPal holds it on a multiparty order with delayed disbursement. We can only tell PayPal to release it or refund it.
- **The check costs cents, so small deals are worth serving.** Most deals are under $300; a human reviewer or a 15 to 20% manager does not pay for itself at that size. A model call does.
- **Every verdict shows its evidence.** Pass or fail per term, each with the exact text, flag or timestamp it relied on, so a decision can be argued with.
- **It checks what people skip.** The paid-promotion disclosure, and whether the post is still up on day 7.
- **It fails safe.** A fail opens a 48-hour fix window before any refund. An unclear case goes to a person. A caption that talks to the checker is flagged, not obeyed.
- **Creators keep 100%.** The brand pays the fee on top. That is the reason a creator says yes to using it.
- **It works on a real post today.** Both paths ran on the hosted site on 11 Nov 2026: a real video passed and $50 was released; a non-compliant one failed and $57.50 was refunded.

## Why it is good for PayPal

- Every creator who gets paid becomes a PayPal business seller.
- Every deal is a branded PayPal checkout. Online branded checkout grew about 1% in Q4 2025, down from 5% the quarter before.
- The money sits with PayPal for the whole hold.
- Creators abroad add cross-border and currency-conversion fees.

## The numbers

| Claim | Figure | Source and confidence |
|---|---|---|
| Market size, 2026 | about $34B (range $34B to $41B) | Influencer Marketing Hub forecast about $34.1B; Mordor Intelligence $40.5B with a wider scope. Secondary sites only. Medium. |
| Typical deal | $255 average on YouTube, $193 Instagram, $186 TikTok; 80% of deals under $300 | Collabstr 2026 report, 21,000 collaborations. Good, but it is one marketplace and averages, not medians. |
| Manager cut | usually 15 to 20% of the deal (range 10 to 25%) | Several agency and legal guides agree on the range. Medium; they are vendor pages. |
| Late payment | brands and agencies typically pay 60 to 90 days after delivery | Digiday reporting. Medium. Do not use the "87% paid late" figure: it traces to a 2022 survey. |
| Manual process | 73% of brand-side teams manage creator payments by hand | Censuswide survey of 1,000 brand professionals, July 2026. Medium. |
| Disclosure risk | up to $53,088 per violation, counted per post; brands are liable, not only creators | Law-firm and marketing blogs citing the FTC. Check on ftc.gov before using the dollar figure. |
| PayPal branded checkout | about +1% in Q4 2025; total payment volume about $1.8 trillion in 2025, up 7% | PayPal Q4 2025 earnings coverage. Good. |

**Our own maths (from the fee code, `src/lib/money.ts`)**

- A $250 deal on the Starter tier: creator receives $250.00, our fee $20.00 (8%), PayPal processing about $10.27, brand pays $280.27. That is 12.1% on top for the brand. A manager at 15 to 20% would take $37.50 to $50.00.
- "Half the cost of a manager" holds for our fee alone (8% against 15 to 20%). Counting PayPal processing as well it is closer to two thirds. Say "our fee is about half a manager's cut".
- 1% of a $34.1B market is $341M of deals a year. At $250 a deal that is about 1.36 million deals a year, 114,000 a month.
- At that volume PayPal earns about $14M a year in processing at US domestic rates (3.49% + $0.49), and up to about $19M if every deal were cross-border (+1.5%).
- We earn about $17M a year at a blended 5% fee, or $27M if every deal were on the 8% Starter tier.

## Lines to avoid

- "First" or "only": ChainReach and the crypto projects claim similar automation.
- "Marketplaces take 10 to 15% from each side": sources on Collabstr's fees disagree (10% brand fee on the free plan; one source says 15% from creators, another says 0% brand commission). Say "marketplaces take a cut and still need a person to approve the release".
- "87% of creators are paid late": old survey.

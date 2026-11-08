// All amounts in integer cents. The creator always receives exactly the agreed price;
// the brand's total is grossed up so that after PayPal's processing fee the net equals
// price + our platform fee.

export type Tier = "starter" | "growth" | "pro" | "enterprise";

export const TIERS: Record<Tier, { label: string; monthlyUsd: number | null; feePct: number }> = {
  starter: { label: "Starter", monthlyUsd: 0, feePct: 8 },
  growth: { label: "Growth", monthlyUsd: 199, feePct: 5 },
  pro: { label: "Pro", monthlyUsd: 999, feePct: 3 },
  enterprise: { label: "Enterprise", monthlyUsd: null, feePct: 3 }, // spend bands negotiated
};

// PayPal standard commercial rate used for the estimate shown in the UI.
// The actual fee is whatever PayPal reports on the capture; we store that separately.
export const PAYPAL_PCT = 3.49;
export const PAYPAL_FIXED_CENTS = 49;

export const MIN_FEE_CENTS = 500;
export const STARTER_FEE_CAP_CENTS = 25_000;

export interface Quote {
  priceCents: number; // creator receives
  platformFeeCents: number; // our fee
  processingFeeCents: number; // PayPal estimate
  brandTotalCents: number; // brand pays
  feePct: number;
}

export function platformFeeCents(priceCents: number, tier: Tier): number {
  const pct = TIERS[tier].feePct;
  let fee = Math.round((priceCents * pct) / 100);
  if (fee < MIN_FEE_CENTS) fee = MIN_FEE_CENTS;
  if (tier === "starter" && fee > STARTER_FEE_CAP_CENTS) fee = STARTER_FEE_CAP_CENTS;
  return fee;
}

/** Gross-up: total T such that T - (T * pct/100 + fixed) = net  =>  T = (net + fixed) / (1 - pct/100). */
export function grossUp(netCents: number): number {
  return Math.round((netCents + PAYPAL_FIXED_CENTS) / (1 - PAYPAL_PCT / 100));
}

export function quote(priceCents: number, tier: Tier = "starter"): Quote {
  const fee = platformFeeCents(priceCents, tier);
  const net = priceCents + fee;
  const total = grossUp(net);
  return {
    priceCents,
    platformFeeCents: fee,
    processingFeeCents: total - net,
    brandTotalCents: total,
    feePct: TIERS[tier].feePct,
  };
}

export function usd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function toAmountString(cents: number): string {
  return (cents / 100).toFixed(2);
}

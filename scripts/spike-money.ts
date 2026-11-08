import { quote, usd } from "../src/lib/money";

for (const [price, tier] of [
  [25000, "starter"],
  [5000, "starter"],
  [100000, "starter"],
  [25000, "growth"],
  [25000, "pro"],
] as const) {
  const q = quote(price, tier);
  console.log(
    `${tier.padEnd(8)} price ${usd(q.priceCents).padStart(10)}  fee ${usd(q.platformFeeCents).padStart(8)} (${q.feePct}%)  paypal ~${usd(q.processingFeeCents).padStart(7)}  brand pays ${usd(q.brandTotalCents)}`,
  );
}

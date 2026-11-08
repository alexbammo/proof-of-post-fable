// Day-1 PayPal multiparty spike. Run: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/spike-paypal.ts
// Goes as far as it can without a human: token -> identity -> partner referral -> platform order.
// Buyer approval needs a sandbox buyer login in a browser, so the script prints the approve link and stops.
import { getAccessToken, paypal, PayPalError } from "../src/lib/paypal/client";
import { createPartnerReferral, createPlatformOrder } from "../src/lib/paypal/multiparty";
import { quote } from "../src/lib/money";

const STAND_IN_SELLER_EMAIL = process.argv[2]; // optional: an existing sandbox business email to use as the creator

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const r = await fn();
    console.log(`\n✔ ${name}`);
    return r;
  } catch (e) {
    if (e instanceof PayPalError) {
      console.log(`\n✘ ${name}: ${e.message}`);
      console.log("   debug_id:", e.debugId, "issues:", JSON.stringify(e.issues));
    } else console.log(`\n✘ ${name}:`, e);
    return undefined;
  }
}

async function main() {
  await step("oauth token", getAccessToken);

  const me = await step("identity (platform account)", () =>
    paypal<{ payer_id?: string; emails?: { value: string; primary: boolean }[]; name?: string }>(
      "/v1/identity/oauth2/userinfo?schema=paypalv1.1",
    ),
  );
  if (me) console.log("   partner payer_id:", me.payer_id, "email:", me.emails?.find((e) => e.primary)?.value);

  const trackingId = `spike-creator-${Date.now()}`;
  const ref = await step("partner referral (creator onboarding link)", () =>
    createPartnerReferral({ trackingId, returnUrl: "http://localhost:3002/creator/onboarded" }),
  );
  if (ref) console.log("   action_url:", ref.actionUrl);

  const q = quote(25_000, "starter");
  const order = await step("create platform order ($250 deal, DELAYED, platform fee)", () =>
    createPlatformOrder({
      dealId: `spike-${Date.now()}`,
      brandTotalCents: q.brandTotalCents,
      platformFeeCents: q.platformFeeCents,
      payee: { email: STAND_IN_SELLER_EMAIL ?? "sb-4yol253743735@business.example.com" },
      description: "Proof of Post spike: 1 Bluesky post, #ad, stays up 7 days",
      returnUrl: "http://localhost:3002/pay/return",
      cancelUrl: "http://localhost:3002/pay/cancel",
    }),
  );
  if (order) {
    console.log("   order id:", order.id, "status:", order.status);
    console.log("   approve link:", order.links.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href);
  }
}
main();

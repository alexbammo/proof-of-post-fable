// Seller onboarding status by tracking id, then the integration details (no DB access; the dev server owns PGlite).
import { getMerchantByTrackingId, getMerchant } from "../src/lib/paypal/multiparty";
async function main() {
  const [partner, tracking] = process.argv.slice(2);
  const m = await getMerchantByTrackingId(partner, tracking);
  console.log("merchant_id:", m.merchant_id);
  const d = await getMerchant(partner, m.merchant_id);
  console.log(JSON.stringify(d, null, 1).slice(0, 3000));
}
main().catch((e) => { console.error("lookup failed:", String((e as Error).message).slice(0, 600)); process.exit(1); });

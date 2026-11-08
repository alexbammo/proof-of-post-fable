// Try a referenced payout against a capture and print PayPal's full response/error.
import { paypal } from "../src/lib/paypal/client";
const [captureId, amount] = process.argv.slice(2);
async function main() {
  const body: Record<string, unknown> = { reference_id: captureId, reference_type: "TRANSACTION_ID" };
  if (amount) body.payout_amount = { currency_code: "USD", value: amount };
  try {
    const r = await paypal<unknown>("/v1/payments/referenced-payouts-items", { body, requestId: `probe-${captureId}-${amount ?? "all"}-${Date.now()}` });
    console.log("OK", JSON.stringify(r, null, 1));
  } catch (e) {
    console.log("FAILED", String((e as Error).message).slice(0, 2000));
  }
}
main();

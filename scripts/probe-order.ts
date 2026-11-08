// Inspect a PayPal order and try the capture, printing PayPal's full error body.
import { paypal } from "../src/lib/paypal/client";
const id = process.argv[2];
async function main() {
  const o = await paypal<Record<string, unknown>>(`/v2/checkout/orders/${id}`);
  console.log("order status:", o.status);
  console.log(JSON.stringify(o, null, 1).slice(0, 3000));
  if (process.argv[3] === "capture") {
    try {
      const c = await paypal<Record<string, unknown>>(`/v2/checkout/orders/${id}/capture`, { body: {}, requestId: `cap-${id}-probe` });
      console.log("CAPTURE OK", JSON.stringify(c, null, 1).slice(0, 2000));
    } catch (e) {
      console.log("CAPTURE FAILED:", String((e as Error).message).slice(0, 2500));
    }
  }
}
main().catch((e) => { console.error(String(e).slice(0, 2500)); process.exit(1); });

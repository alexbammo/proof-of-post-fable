import { paypal } from "../src/lib/paypal/client";
paypal<unknown>(`/v2/payments/captures/${process.argv[2]}`).then((r) => console.log(JSON.stringify(r, null, 1))).catch((e) => console.log("FAILED", String(e.message).slice(0, 1500)));

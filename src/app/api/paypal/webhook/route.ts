import { handler, ok } from "@/lib/http";
import { paypal } from "@/lib/paypal/client";
import { audit } from "@/lib/audit";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

// PayPal webhook listener. Verifies the signature with PayPal (verify-webhook-signature), then logs the event
// against the deal (custom_id carries the deal id on orders/captures/refunds).
export const POST = handler(async (req: Request) => {
  const raw = await req.text();
  let event: { id: string; event_type: string; resource?: Record<string, unknown>; summary?: string };
  try {
    event = JSON.parse(raw);
  } catch {
    return ok({ ignored: "bad json" }, { status: 400 });
  }

  let verified: boolean | "skipped" = "skipped";
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (webhookId) {
    const h = (n: string) => req.headers.get(n) ?? "";
    const v = await paypal<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
      body: {
        auth_algo: h("paypal-auth-algo"),
        cert_url: h("paypal-cert-url"),
        transmission_id: h("paypal-transmission-id"),
        transmission_sig: h("paypal-transmission-sig"),
        transmission_time: h("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: event,
      },
    });
    verified = v.verification_status === "SUCCESS";
    if (!verified) return ok({ ignored: "signature failed" }, { status: 400 });
  }

  const res = event.resource ?? {};
  const customId = (res.custom_id as string | undefined) ?? ((res.purchase_units as { custom_id?: string }[] | undefined)?.[0]?.custom_id);
  const dealId = customId && customId.startsWith("deal_") ? customId : null;
  if (dealId) {
    const db = await getDb();
    const [d] = await db.select({ id: schema.deals.id }).from(schema.deals).where(eq(schema.deals.id, dealId));
    await audit(d ? dealId : null, "paypal", `webhook:${event.event_type}`, { eventId: event.id, verified, summary: event.summary, resourceId: res.id, status: res.status });
  } else {
    await audit(null, "paypal", `webhook:${event.event_type}`, { eventId: event.id, verified, summary: event.summary, resourceId: res.id });
  }
  return ok({ received: true, verified });
});

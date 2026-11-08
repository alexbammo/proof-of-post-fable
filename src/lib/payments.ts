import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Deal, Payment } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { getDeal, getDealFull, setStatus } from "@/lib/deals";
import { paypalConfigured } from "@/lib/paypal/client";
import * as mp from "@/lib/paypal/multiparty";

// Money movement for a deal, on top of the multiparty PayPal flow.
// Every call records a payments row and an audit event, and never trusts client-supplied amounts.

export const PAYMENT_MODE = "multiparty" as const;

function appUrl() {
  return process.env.APP_URL ?? "http://localhost:3002";
}

export async function latestPayment(dealId: string): Promise<Payment | null> {
  const db = await getDb();
  const rows = await db.select().from(schema.payments).where(eq(schema.payments.dealId, dealId)).orderBy(desc(schema.payments.createdAt)).limit(1);
  return rows[0] ?? null;
}

/** Step 1: brand clicks Pay. Creates the PayPal order with the creator as payee. Returns the approve URL. */
export async function startCheckout(dealId: string): Promise<{ orderId: string; approveUrl: string }> {
  if (!paypalConfigured()) throw new Error("PayPal is not configured on this server");
  const full = await getDealFull(dealId);
  if (!full) throw new Error("deal not found");
  const { deal, creator } = full;
  if (deal.status !== "agreed") throw new Error(`Deal must be agreed before payment (is ${deal.status})`);
  if (!creator.paypalMerchantId && !creator.paypalEmail) throw new Error("Creator has not linked a PayPal account yet");

  const order = await mp.createPlatformOrder({
    dealId,
    brandTotalCents: deal.brandTotalCents,
    platformFeeCents: deal.platformFeeCents,
    payee: creator.paypalMerchantId ? { merchantId: creator.paypalMerchantId } : { email: creator.paypalEmail! },
    description: `Proof of Post deal: ${deal.title}`,
    returnUrl: `${appUrl()}/pay/${dealId}/return`,
    cancelUrl: `${appUrl()}/deals/${dealId}?cancelled=1`,
  });
  const approveUrl = order.links.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  if (!approveUrl) throw new Error("PayPal did not return an approval link");

  const db = await getDb();
  await db.insert(schema.payments).values({
    id: newId("pay"),
    dealId,
    mode: PAYMENT_MODE,
    paypalOrderId: order.id,
    status: "created",
    amountCents: deal.brandTotalCents,
    raw: { create: order },
  });
  await audit(dealId, `brand:${deal.brandId}`, "payment:order_created", { orderId: order.id, amountCents: deal.brandTotalCents });
  return { orderId: order.id, approveUrl };
}

/**
 * Step 2: buyer approved and came back. Capture; funds are now held by PayPal (DELAYED).
 * The deal only advances when the capture is COMPLETED; a PENDING capture stays "captured" until the webhook or a retry.
 */
export async function completeCheckout(dealId: string, orderId: string): Promise<Payment> {
  const deal = await getDeal(dealId);
  if (!deal) throw new Error("deal not found");
  const payment = await latestPayment(dealId);
  if (!payment || payment.paypalOrderId !== orderId) throw new Error("order does not match this deal");
  if (payment.status === "held") return payment; // idempotent

  const captured = await mp.captureOrder(orderId);
  const cap = captured.purchase_units?.[0]?.payments?.captures?.[0];
  if (!cap) throw new Error("capture returned no capture object");
  const completed = cap.status === "COMPLETED";

  const db = await getDb();
  await db
    .update(schema.payments)
    .set({ paypalCaptureId: cap.id, status: completed ? "held" : "captured", raw: { ...(payment.raw as object), capture: captured }, updatedAt: new Date() })
    .where(eq(schema.payments.id, payment.id));
  await audit(dealId, "paypal", completed ? "payment:captured_held" : "payment:capture_pending", { captureId: cap.id, status: cap.status, amount: cap.amount?.value });

  if (completed) {
    if (deal.status === "agreed") await setStatus(dealId, "funded", "system", { captureId: cap.id });
    if ((await getDeal(dealId))?.status === "funded") await setStatus(dealId, "awaiting_post", "system");
  }
  return (await latestPayment(dealId))!;
}

/** A capture that came back PENDING at checkout: ask PayPal again and advance the deal once it is COMPLETED. */
export async function reconcilePendingCapture(dealId: string): Promise<"completed" | "pending" | "none"> {
  const payment = await latestPayment(dealId);
  if (!payment?.paypalCaptureId || payment.status !== "captured") return "none";
  const cap = await mp.getCapture(payment.paypalCaptureId);
  if (cap.status !== "COMPLETED") return "pending";
  const db = await getDb();
  await db.update(schema.payments).set({ status: "held", raw: { ...(payment.raw as object), captureNow: cap }, updatedAt: new Date() }).where(eq(schema.payments.id, payment.id));
  await audit(dealId, "paypal", "payment:captured_held", { captureId: cap.id, status: cap.status, via: "reconcile" });
  const deal = await getDeal(dealId);
  if (deal?.status === "agreed") await setStatus(dealId, "funded", "system", { captureId: cap.id });
  if ((await getDeal(dealId))?.status === "funded") await setStatus(dealId, "awaiting_post", "system");
  return "completed";
}

/**
 * Release held funds so that the creator has received `cumulativePct` of the price in total.
 * Idempotent per stage: calling it again with the same (or a lower) percentage releases nothing.
 * Does not finish the deal; `finishDeal` does that once the stay-up obligation is met.
 */
export async function releaseToCreator(dealId: string, cumulativePct: number, reason: string) {
  const deal = await getDeal(dealId);
  if (!deal) throw new Error("deal not found");
  const payment = await latestPayment(dealId);
  if (!payment?.paypalCaptureId || payment.status === "refunded") throw new Error("nothing captured to release");

  const pct = Math.max(0, Math.min(100, cumulativePct));
  const target = Math.min(deal.priceCents, Math.round((deal.priceCents * pct) / 100));
  const amount = target - deal.releasedCents;
  if (amount <= 0) return { amountCents: 0 };

  const newReleased = deal.releasedCents + amount;
  // Omitting payout_amount releases the entire held balance to the seller: the single-stage case.
  const releaseAll = deal.releasedCents === 0 && newReleased === deal.priceCents;
  const item = await mp.releaseCapture(payment.paypalCaptureId, releaseAll ? undefined : amount, `rel-${payment.paypalCaptureId}-${deal.releasedCents}-${amount}`);
  const payoutState = item.processing_state?.status?.toUpperCase() ?? "";
  if (["FAILED", "BLOCKED", "DENIED", "REFUNDED", "RETURNED", "REVERSED", "CANCELED", "CANCELLED"].includes(payoutState)) {
    await audit(dealId, "paypal", "payment:release_failed", { amountCents: amount, state: item.processing_state, itemId: item.item_id });
    throw new Error(`PayPal did not release the funds (${payoutState}${item.processing_state?.reason ? ": " + item.processing_state.reason : ""})`);
  }

  const db = await getDb();
  await db.update(schema.deals).set({ releasedCents: newReleased, updatedAt: new Date() }).where(eq(schema.deals.id, dealId));
  await db
    .update(schema.payments)
    .set({ paypalPayoutBatchId: item.item_id ?? null, status: newReleased >= deal.priceCents ? "released" : "held", raw: { ...(payment.raw as object), release: item }, updatedAt: new Date() })
    .where(eq(schema.payments.id, payment.id));
  await audit(dealId, "paypal", "payment:released", { amountCents: amount, cumulativePct: pct, reason, itemId: item.item_id, state: item.processing_state });

  if (newReleased < deal.priceCents && deal.status === "live_checking") {
    await setStatus(dealId, "partially_released", "system", { reason, cumulativePct: pct });
  }
  return { amountCents: amount, item };
}

/** Stay-up obligation met: release whatever is still owed and close the deal as released. */
export async function finishDeal(dealId: string, reason: string) {
  const r = await releaseToCreator(dealId, 100, reason);
  const deal = (await getDeal(dealId))!;
  if (deal.status !== "released") await setStatus(dealId, "released", "system", { reason });
  return r;
}

/**
 * Refund the brand everything not yet released to the creator, and hand back our platform fee with it.
 * The refund amount is computed here from the ledger, never taken from PayPal's "refund all" default,
 * because a partial release does not reduce what PayPal would otherwise refund.
 */
export async function refundBrand(dealId: string, reason: string) {
  const full = await getDealFull(dealId);
  if (!full) throw new Error("deal not found");
  const { deal, creator } = full;
  const payment = await latestPayment(dealId);
  if (!payment?.paypalCaptureId) throw new Error("nothing captured to refund");
  if (payment.status === "refunded") throw new Error("nothing left to refund");

  const refundable = deal.brandTotalCents - deal.releasedCents;
  if (refundable <= 0) throw new Error("nothing left to refund");
  const refund = await mp.refundCapture(payment.paypalCaptureId, refundable, reason, creator.paypalMerchantId ?? undefined, deal.platformFeeCents);
  if (["FAILED", "CANCELLED", "CANCELED"].includes(refund.status?.toUpperCase() ?? "")) {
    await audit(dealId, "paypal", "payment:refund_failed", { refundId: refund.id, status: refund.status, amountCents: refundable });
    throw new Error(`PayPal did not refund the brand (${refund.status})`);
  }

  const db = await getDb();
  await db.update(schema.deals).set({ refundedCents: refundable, updatedAt: new Date() }).where(eq(schema.deals.id, dealId));
  await db
    .update(schema.payments)
    .set({ paypalRefundId: refund.id, status: "refunded", raw: { ...(payment.raw as object), refund }, updatedAt: new Date() })
    .where(eq(schema.payments.id, payment.id));
  await audit(dealId, "paypal", "payment:refunded", { refundId: refund.id, status: refund.status, amountCents: refundable, platformFeeCents: deal.platformFeeCents, reason });
  if (deal.status !== "refunded") await setStatus(dealId, "refunded", "system", { reason });
  return refund;
}

/** Cumulative share of the price the creator is entitled to after an event. */
export function releasePlanFor(deal: Deal, event: "go_live" | "stay_up_complete"): number {
  if (event === "stay_up_complete") return 100;
  return deal.terms.payoutSchedule.atGoLivePct;
}

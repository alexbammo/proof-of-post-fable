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
 * Release the held funds to the creator once `cumulativePct` reaches 100. Idempotent: a second call releases nothing.
 * Does not finish the deal; `finishDeal` does that once the stay-up obligation is met.
 */
export async function releaseToCreator(dealId: string, cumulativePct: number, reason: string) {
  const deal = await getDeal(dealId);
  if (!deal) throw new Error("deal not found");
  const payment = await latestPayment(dealId);
  if (!payment?.paypalCaptureId || payment.status === "refunded") throw new Error("nothing captured to release");

  // Single-stage only. Verified 8 Nov 2026: a referenced payout with payout_amount (a partial release) is rejected by
  // PayPal with 422 AMOUNT_CHECK_FAILED, while omitting the amount releases the whole held balance. So the only
  // release we ever make is "everything", once.
  if (cumulativePct < 100) return { amountCents: 0 };
  const amount = deal.priceCents - deal.releasedCents;
  if (amount <= 0) return { amountCents: 0 };
  const newReleased = deal.priceCents;
  const item = await mp.releaseCapture(payment.paypalCaptureId, undefined, `rel-${payment.paypalCaptureId}-all`);
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
  await audit(dealId, "paypal", "payment:released", { amountCents: amount, reason, itemId: item.item_id, state: item.processing_state });

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
 * Refund the brand everything not yet released to the creator. The amount is computed here from the ledger,
 * never taken from PayPal's "refund all" default.
 * The platform fee needs no separate instruction: on a DELAYED capture that was never disbursed, the fee is still
 * part of the held gross, so refunding the gross returns it too. Verified 9 Nov 2026: sending
 * payment_instruction.platform_fees on the refund is rejected with 422 PLATFORM_FEE_NOT_ENABLED (that field is a
 * partner contribution, gated by an account capability), so it is deliberately omitted.
 */
export async function refundBrand(dealId: string, reason: string) {
  const full = await getDealFull(dealId);
  if (!full) throw new Error("deal not found");
  const { deal, creator } = full;
  const payment = await latestPayment(dealId);
  if (!payment?.paypalCaptureId) throw new Error("nothing captured to refund");
  if (payment.status === "refunded") {
    // PayPal already refunded and the payment row says so; a crash may have left the deal behind. Finish it.
    if (deal.status === "refunded") throw new Error("nothing left to refund");
    const dbr = await getDb();
    await dbr.update(schema.deals).set({ refundedCents: deal.brandTotalCents, updatedAt: new Date() }).where(eq(schema.deals.id, dealId));
    await setStatus(dealId, "refunded", "system", { reason: `${reason} (completing an earlier refund ${payment.paypalRefundId ?? ""})` });
    return { id: payment.paypalRefundId ?? "", status: "COMPLETED" };
  }
  // Once anything has been released the capture is disbursed and a refund would debit the creator, not PayPal's
  // hold. The ledger would still show the fee gross-up (brandTotal - price) as "refundable"; it is not. Only the
  // undisbursed full refund is verified, so that is the only refund we make.
  if (deal.releasedCents > 0) throw new Error("funds already released to the creator; refund is not available");

  const refundable = deal.brandTotalCents - deal.releasedCents;
  if (refundable <= 0) throw new Error("nothing left to refund");
  // The refund is a seller-scoped call: PayPal wants the seller's merchant id in PayPal-Auth-Assertion and answers
  // 403 PERMISSION_DENIED without it (seen 11 Nov 2026 on a creator linked by email only). The seller that matters
  // is the one this capture was made to, not whoever the creator is linked to today, so the id is resolved per
  // payment (saved on the payment row, never written back to the creator): saved value, then the order's payee,
  // then the creator's stored id.
  const raw = (payment.raw ?? {}) as { sellerMerchantId?: string };
  let sellerId = raw.sellerMerchantId;
  if (!sellerId && payment.paypalOrderId) {
    try {
      const order = await mp.getOrder(payment.paypalOrderId);
      sellerId = order.purchase_units?.[0]?.payee?.merchant_id;
    } catch (e) {
      await audit(dealId, "paypal", "payment:seller_lookup_failed", { orderId: payment.paypalOrderId, error: e instanceof Error ? e.message : String(e) });
    }
    if (sellerId) {
      const db0 = await getDb();
      await db0.update(schema.payments).set({ raw: { ...raw, sellerMerchantId: sellerId }, updatedAt: new Date() }).where(eq(schema.payments.id, payment.id));
      await audit(dealId, "paypal", "payment:seller_resolved", { merchantId: sellerId, from: "order payee" });
    }
  }
  sellerId ??= creator.paypalMerchantId ?? undefined;
  if (!sellerId) throw new Error("cannot refund: PayPal did not tell us which seller account this payment went to (order lookup failed and the creator has no merchant id)");
  const refund = await mp.refundCapture(payment.paypalCaptureId, refundable, reason, sellerId);
  if (["FAILED", "CANCELLED", "CANCELED"].includes(refund.status?.toUpperCase() ?? "")) {
    await audit(dealId, "paypal", "payment:refund_failed", { refundId: refund.id, status: refund.status, amountCents: refundable });
    throw new Error(`PayPal did not refund the brand (${refund.status})`);
  }

  const db = await getDb();
  await db.update(schema.deals).set({ refundedCents: refundable, updatedAt: new Date() }).where(eq(schema.deals.id, dealId));
  await db
    .update(schema.payments)
    .set({ paypalRefundId: refund.id, status: "refunded", raw: { ...(payment.raw as object), sellerMerchantId: sellerId, refund }, updatedAt: new Date() })
    .where(eq(schema.payments.id, payment.id));
  await audit(dealId, "paypal", "payment:refunded", { refundId: refund.id, status: refund.status, amountCents: refundable, platformFeeCents: deal.platformFeeCents, reason });
  if (deal.status !== "refunded") await setStatus(dealId, "refunded", "system", { reason });
  return refund;
}

/**
 * A failed deal is closed one of two ways: refund the brand while PayPal still holds the money, or, if the creator
 * has already been paid (100%-at-go-live deals whose post later disappears), mark it disputed for a human; nothing
 * is clawed back automatically.
 */
export async function closeFailedDeal(dealId: string, reason: string): Promise<{ outcome: "refunded"; refund: Awaited<ReturnType<typeof refundBrand>> } | { outcome: "disputed" }> {
  const deal = await getDeal(dealId);
  if (!deal) throw new Error("deal not found");
  if (deal.releasedCents > 0) {
    await audit(dealId, "system", "payment:refund_not_available", { releasedCents: deal.releasedCents, reason });
    await setStatus(dealId, "disputed", "system", { reason: `${reason}; creator already paid, needs a human` });
    return { outcome: "disputed" };
  }
  const refund = await refundBrand(dealId, reason);
  return { outcome: "refunded", refund };
}

/** Share of the price the creator is entitled to after an event: 100 or 0, single stage only. */
export function releasePlanFor(deal: Deal, event: "go_live" | "stay_up_complete"): number {
  if (event === "stay_up_complete") return 100;
  return deal.terms.payoutSchedule.atGoLivePct >= 100 ? 100 : 0;
}

/** Only two schedules are allowed: paid when verified, or paid after the stay-up period. */
export function isValidPayoutSchedule(s: { atGoLivePct: number; afterStayUpPct: number }) {
  return (s.atGoLivePct === 100 && s.afterStayUpPct === 0) || (s.atGoLivePct === 0 && s.afterStayUpPct === 100);
}

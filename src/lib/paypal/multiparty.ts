import { paypal } from "./client";
import { toAmountString } from "@/lib/money";

// Multiparty (platform) flow:
//   1. partner referral  -> creator signs up / connects as a seller, we get merchant_id
//   2. create order      -> payee = creator merchant_id, platform_fees = our fee, disbursement DELAYED
//   3. buyer approves    -> capture (funds held by PayPal, not yet disbursed to seller)
//   4. check passes      -> referenced payout releases the held capture to the seller
//      check fails       -> refund the capture to the buyer
// Field names from developer.paypal.com/docs/multiparty (read 8 Nov 2026).

// ---------- 1. Seller onboarding ----------

export interface PartnerReferralResult {
  links: { href: string; rel: string; method: string }[];
  actionUrl: string | null;
}

export async function createPartnerReferral(params: {
  trackingId: string;
  returnUrl: string;
  sellerEmail?: string;
}): Promise<PartnerReferralResult> {
  const body = {
    tracking_id: params.trackingId,
    ...(params.sellerEmail ? { email: params.sellerEmail } : {}),
    operations: [
      {
        operation: "API_INTEGRATION",
        api_integration_preference: {
          rest_api_integration: {
            integration_method: "PAYPAL",
            integration_type: "THIRD_PARTY",
            third_party_details: {
              features: ["PAYMENT", "REFUND", "PARTNER_FEE", "DELAY_FUNDS_DISBURSEMENT"],
            },
          },
        },
      },
    ],
    products: ["EXPRESS_CHECKOUT"],
    legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }],
    partner_config_override: {
      return_url: params.returnUrl,
      return_url_description: "Back to Proof of Post",
      show_add_credit_card: false,
    },
  };
  const r = await paypal<{ links: PartnerReferralResult["links"] }>("/v2/customer/partner-referrals", { body });
  return { links: r.links, actionUrl: r.links.find((l) => l.rel === "action_url")?.href ?? null };
}

export interface MerchantIntegration {
  merchant_id: string;
  tracking_id?: string;
  payments_receivable?: boolean;
  primary_email_confirmed?: boolean;
  oauth_integrations?: { oauth_third_party?: { scopes?: string[] }[] }[];
  products?: { name: string; vetting_status?: string; capabilities?: string[] }[];
  capabilities?: { name: string; status: string }[];
}

/** Look up an onboarded seller by the tracking id we gave the referral. */
export async function getMerchantByTrackingId(partnerMerchantId: string, trackingId: string) {
  return paypal<MerchantIntegration>(
    `/v1/customer/partners/${partnerMerchantId}/merchant-integrations?tracking_id=${encodeURIComponent(trackingId)}`,
  );
}

export async function getMerchant(partnerMerchantId: string, sellerMerchantId: string) {
  return paypal<MerchantIntegration>(`/v1/customer/partners/${partnerMerchantId}/merchant-integrations/${sellerMerchantId}`);
}

// ---------- 2. Orders ----------

export interface OrderResult {
  id: string;
  status: string;
  links: { href: string; rel: string; method: string }[];
  purchase_units?: {
    payments?: {
      captures?: { id: string; status: string; amount: { value: string }; seller_receivable_breakdown?: unknown }[];
      authorizations?: { id: string; status: string }[];
    };
  }[];
}

export async function createPlatformOrder(params: {
  dealId: string;
  brandTotalCents: number;
  platformFeeCents: number;
  payee: { merchantId?: string; email?: string };
  description: string;
  returnUrl: string;
  cancelUrl: string;
  intent?: "CAPTURE" | "AUTHORIZE";
}): Promise<OrderResult> {
  const payee = params.payee.merchantId ? { merchant_id: params.payee.merchantId } : { email_address: params.payee.email };
  const body = {
    intent: params.intent ?? "CAPTURE",
    purchase_units: [
      {
        reference_id: params.dealId,
        custom_id: params.dealId,
        description: params.description.slice(0, 127),
        amount: { currency_code: "USD", value: toAmountString(params.brandTotalCents) },
        payee,
        payment_instruction: {
          disbursement_mode: "DELAYED",
          platform_fees: [{ amount: { currency_code: "USD", value: toAmountString(params.platformFeeCents) } }],
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "Proof of Post",
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
        },
      },
    },
  };
  return paypal<OrderResult>("/v2/checkout/orders", { body, requestId: `order-${params.dealId}-${Date.now()}` });
}

export async function getOrder(orderId: string) {
  return paypal<OrderResult>(`/v2/checkout/orders/${orderId}`);
}

export async function getCapture(captureId: string) {
  return paypal<{ id: string; status: string; amount?: { value: string; currency_code: string } }>(`/v2/payments/captures/${captureId}`);
}
export async function captureOrder(orderId: string) {
  return paypal<OrderResult>(`/v2/checkout/orders/${orderId}/capture`, { body: {}, requestId: `cap-${orderId}` });
}

export async function authorizeOrder(orderId: string) {
  return paypal<OrderResult>(`/v2/checkout/orders/${orderId}/authorize`, { body: {}, requestId: `auth-${orderId}` });
}

export async function captureAuthorization(authorizationId: string, amountCents?: number) {
  const body = amountCents ? { amount: { currency_code: "USD", value: toAmountString(amountCents) }, final_capture: true } : {};
  return paypal<{ id: string; status: string }>(`/v2/payments/authorizations/${authorizationId}/capture`, { body });
}

// ---------- 3. Release held funds ----------

export interface ReferencedPayoutItem {
  item_id?: string;
  processing_state?: { status: string; reason?: string };
  reference_id: string;
  reference_type: string;
  payout_amount?: { currency_code: string; value: string };
  payout_transaction_id?: string;
  links?: { href: string; rel: string }[];
}

/** Release a DELAYED capture to the seller. Omit amount to release the whole remaining balance. */
/**
 * Release held funds to the seller. `requestId` must be unique per stage (two equal 50% stages
 * would otherwise share an idempotency key and PayPal would replay the first payout).
 */
export async function releaseCapture(captureId: string, amountCents: number | undefined, requestId: string) {
  const body: Record<string, unknown> = { reference_id: captureId, reference_type: "TRANSACTION_ID" };
  if (amountCents) body.payout_amount = { currency_code: "USD", value: toAmountString(amountCents) };
  return paypal<ReferencedPayoutItem>("/v1/payments/referenced-payouts-items", { body, requestId });
}

export async function getReferencedPayoutItem(itemId: string) {
  return paypal<ReferencedPayoutItem>(`/v1/payments/referenced-payouts-items/${itemId}`);
}

// ---------- 4. Refund ----------

/**
 * Refund the brand. `platformFeeCents` adds payment_instruction.platform_fees, a partner *contribution* to the
 * refund. It needs an account capability our sandbox app lacks (422 PLATFORM_FEE_NOT_ENABLED, 9 Nov 2026). Verified
 * only for a FULL refund of an undisbursed DELAYED capture: the held gross already contains the fee and PayPal
 * returned all of it (platform_fees 5.00 in the refund breakdown). Partial refunds are untested here.
 */
export async function refundCapture(captureId: string, amountCents?: number, note?: string, sellerMerchantId?: string, platformFeeCents?: number) {
  const body: Record<string, unknown> = {};
  if (amountCents) body.amount = { currency_code: "USD", value: toAmountString(amountCents) };
  if (note) body.note_to_payer = note.slice(0, 255);
  if (platformFeeCents) body.payment_instruction = { platform_fees: [{ amount: { currency_code: "USD", value: toAmountString(platformFeeCents) } }] };
  const { authAssertion } = await import("./client");
  return paypal<{ id: string; status: string }>(`/v2/payments/captures/${captureId}/refund`, {
    body,
    requestId: `ref-${captureId}-${Date.now()}`,
    authAssertion: sellerMerchantId ? authAssertion(sellerMerchantId) : undefined,
  });
}

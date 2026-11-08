import { paypal } from "./client";
import { toAmountString } from "@/lib/money";

// Fallback mode: the brand pays OUR platform account with a standard Orders v2 checkout,
// we hold the deal in our database, and on a pass we pay the creator with the Payouts API.
// Only used if the multiparty path fails in the sandbox. The README must say which is live.

export async function createStandardOrder(params: {
  dealId: string;
  brandTotalCents: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: params.dealId,
        custom_id: params.dealId,
        description: params.description.slice(0, 127),
        amount: { currency_code: "USD", value: toAmountString(params.brandTotalCents) },
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
  return paypal<{ id: string; status: string; links: { href: string; rel: string }[] }>("/v2/checkout/orders", {
    body,
    requestId: `std-${params.dealId}-${Date.now()}`,
  });
}

export interface PayoutBatch {
  batch_header: { payout_batch_id: string; batch_status: string };
  links?: { href: string; rel: string }[];
}

export async function payoutToEmail(params: { dealId: string; email: string; amountCents: number; note: string }) {
  const body = {
    sender_batch_header: {
      sender_batch_id: `deal-${params.dealId}-${Date.now()}`,
      email_subject: "Your Proof of Post payout",
      email_message: params.note,
    },
    items: [
      {
        recipient_type: "EMAIL",
        amount: { value: toAmountString(params.amountCents), currency: "USD" },
        receiver: params.email,
        note: params.note.slice(0, 4000),
        sender_item_id: `deal-${params.dealId}`,
      },
    ],
  };
  return paypal<PayoutBatch>("/v1/payments/payouts", { body });
}

export async function getPayoutBatch(batchId: string) {
  return paypal<PayoutBatch & { items?: { transaction_status: string; payout_item_id: string }[] }>(
    `/v1/payments/payouts/${batchId}`,
  );
}

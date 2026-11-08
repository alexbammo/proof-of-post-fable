import { NextResponse } from "next/server";
import { getCreator, setCreatorPayPal } from "@/lib/parties";
import { getMerchantByTrackingId, getMerchant } from "@/lib/paypal/multiparty";
import { audit } from "@/lib/audit";

// PayPal returns the creator here after seller onboarding. The redirect carries merchantIdInPayPal, but we do not
// trust the query string: we ask PayPal which merchant completed onboarding under the tracking id we issued.
// Verified 8 Nov 2026: a seller who consented maps tracking_id -> merchant_id via /v1/customer/partners/.../merchant-integrations.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const creatorId = url.searchParams.get("creator");
  const base = process.env.APP_URL ?? url.origin;
  const partner = process.env.PAYPAL_PLATFORM_MERCHANT_ID;
  const creator = creatorId ? await getCreator(creatorId) : null;
  if (!creator?.onboardingTrackingId || !partner) return NextResponse.redirect(`${base}/creator?linked=0`);

  try {
    const m = await getMerchantByTrackingId(partner, creator.onboardingTrackingId);
    const details = await getMerchant(partner, m.merchant_id).catch(() => null);
    const claimed = url.searchParams.get("merchantIdInPayPal");
    await setCreatorPayPal(creator.id, { paypalMerchantId: m.merchant_id, onboardingStatus: "complete" });
    await audit(null, `creator:${creator.id}`, "paypal:onboarded", {
      merchantId: m.merchant_id,
      trackingId: creator.onboardingTrackingId,
      claimedMerchantId: claimed,
      matchesRedirect: claimed ? claimed === m.merchant_id : null,
      paymentsReceivable: details?.payments_receivable ?? null,
      primaryEmailConfirmed: details?.primary_email_confirmed ?? null,
      checkout: details?.capabilities?.find((c) => c.name === "PAYPAL_CHECKOUT")?.status ?? null,
    });
    return NextResponse.redirect(`${base}/creator?linked=1`);
  } catch (e) {
    await audit(null, `creator:${creator.id}`, "paypal:onboarding_unverified", { error: e instanceof Error ? e.message.slice(0, 300) : String(e) });
    return NextResponse.redirect(`${base}/creator?linked=0`);
  }
}

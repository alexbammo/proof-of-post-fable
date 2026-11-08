import { NextResponse } from "next/server";
import { setCreatorPayPal } from "@/lib/parties";
import { audit } from "@/lib/audit";

// PayPal returns the creator here after seller onboarding with merchantIdInPayPal (+ permissionsGranted etc.).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const creatorId = url.searchParams.get("creator");
  const merchantId = url.searchParams.get("merchantIdInPayPal");
  const base = process.env.APP_URL ?? url.origin;
  if (creatorId && merchantId) {
    await setCreatorPayPal(creatorId, { paypalMerchantId: merchantId, onboardingStatus: "complete" });
    await audit(null, `creator:${creatorId}`, "paypal:onboarded", {
      merchantId,
      permissionsGranted: url.searchParams.get("permissionsGranted"),
      consentStatus: url.searchParams.get("consentStatus"),
      isEmailConfirmed: url.searchParams.get("isEmailConfirmed"),
    });
    return NextResponse.redirect(`${base}/creator?linked=1`);
  }
  return NextResponse.redirect(`${base}/creator?linked=0`);
}

import { handler, ok, bad, readJson } from "@/lib/http";
import { getCreator, setCreatorPayPal } from "@/lib/parties";
import { createPartnerReferral } from "@/lib/paypal/multiparty";
import { paypalConfigured } from "@/lib/paypal/client";
import { newId } from "@/lib/ids";
import { audit } from "@/lib/audit";

// Creator links PayPal. Two ways:
//  POST {}                       → partner referral; returns the PayPal sign-up/connect URL (full onboarding)
//  POST { paypalEmail }          → quick link by sandbox email (payee by email_address). Marked as such in the audit log.
export const POST = handler(async (req: Request, ctx: RouteContext<"/api/creators/[id]/onboard">) => {
  const { id } = await ctx.params;
  const creator = await getCreator(id);
  if (!creator) return bad("creator not found", 404);
  const body = await readJson<{ paypalEmail?: string }>(req).catch(() => ({}) as { paypalEmail?: string });

  if (body.paypalEmail) {
    await setCreatorPayPal(id, { paypalEmail: body.paypalEmail.trim(), onboardingStatus: "complete" });
    await audit(null, `creator:${id}`, "paypal:linked_by_email", { email: body.paypalEmail.trim() });
    return ok({ linked: true, method: "email" });
  }

  if (!paypalConfigured()) return bad("PayPal is not configured on this server");
  const trackingId = `pop-${id}-${newId("t", 6)}`;
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const ref = await createPartnerReferral({ trackingId, returnUrl: `${base}/creator/onboarded?creator=${id}&tracking=${trackingId}` });
  await setCreatorPayPal(id, { onboardingTrackingId: trackingId, onboardingStatus: "pending" });
  await audit(null, `creator:${id}`, "paypal:referral_created", { trackingId });
  return ok({ actionUrl: ref.actionUrl, trackingId });
});

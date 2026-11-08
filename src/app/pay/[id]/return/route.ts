import { NextResponse } from "next/server";
import { completeCheckout } from "@/lib/payments";

// PayPal sends the buyer back here after approval with ?token=<orderId>&PayerID=...
export async function GET(req: Request, ctx: RouteContext<"/pay/[id]/return">) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const orderId = url.searchParams.get("token");
  const base = process.env.APP_URL ?? url.origin;
  if (!orderId) return NextResponse.redirect(`${base}/deals/${id}?error=missing_token`);
  try {
    const payment = await completeCheckout(id, orderId);
    return NextResponse.redirect(`${base}/deals/${id}?${payment.status === "held" ? "paid=1" : "pending=1"}`);
  } catch (e) {
    console.error("capture failed", e);
    return NextResponse.redirect(`${base}/deals/${id}?error=capture_failed`);
  }
}

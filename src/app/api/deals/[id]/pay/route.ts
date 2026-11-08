import { handler, ok } from "@/lib/http";
import { startCheckout } from "@/lib/payments";

// Brand starts PayPal checkout. Returns the approval URL to redirect to.
export const POST = handler(async (_req: Request, ctx: RouteContext<"/api/deals/[id]/pay">) => {
  const { id } = await ctx.params;
  const r = await startCheckout(id);
  return ok(r);
});

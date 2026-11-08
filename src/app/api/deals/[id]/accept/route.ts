import { handler, ok, bad, readJson } from "@/lib/http";
import { acceptTerms, getDeal } from "@/lib/deals";

export const POST = handler(async (req: Request, ctx: RouteContext<"/api/deals/[id]/accept">) => {
  const { id } = await ctx.params;
  const body = await readJson<{ side: "brand" | "creator" }>(req);
  if (!["brand", "creator"].includes(body.side)) return bad("side must be brand or creator");
  const deal = await getDeal(id);
  if (!deal) return bad("deal not found", 404);
  const t = deal.terms;
  const missing = [
    !t.platform && "platform",
    !t.creatorAccount && "creator account",
    !t.deliverable && "deliverable",
    !t.postBy && "post-by date",
    !(t.priceUsd > 0) && "price",
  ].filter(Boolean);
  if (missing.length) return bad(`Terms are incomplete: ${missing.join(", ")}`);
  const agreed = await acceptTerms(id, body.side);
  return ok({ agreed, status: (await getDeal(id))!.status });
});

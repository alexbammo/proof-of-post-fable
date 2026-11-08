import { handler, ok, bad, readJson } from "@/lib/http";
import { getDealFull, updateDraftTerms } from "@/lib/deals";
import type { DealTerms } from "@/lib/db/schema";
import { audit } from "@/lib/audit";

// Manual edit of draft terms (used when AI is unavailable, and for the demo seeding).
export const PUT = handler(async (req: Request, ctx: RouteContext<"/api/deals/[id]/terms">) => {
  const { id } = await ctx.params;
  const full = await getDealFull(id);
  if (!full) return bad("deal not found", 404);
  if (full.deal.status !== "draft") return bad("deal terms are locked once accepted");
  const body = await readJson<Partial<DealTerms>>(req);
  const terms: DealTerms = { ...full.deal.terms, ...body };
  await updateDraftTerms(id, terms, (full.brand.tier as "starter") ?? "starter");
  await audit(id, "user", "terms:edited", { fields: Object.keys(body) });
  return ok({ terms });
});

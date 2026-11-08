import { handler, ok, readJson } from "@/lib/http";
import { createDraftDeal, listDeals } from "@/lib/deals";
import { emptyTerms } from "@/lib/ai/deal-builder";
import { ensureDemoParties, DEMO_BRAND_ID, DEMO_CREATOR_ID } from "@/lib/parties";

export const GET = handler(async () => {
  await ensureDemoParties();
  return ok({ deals: await listDeals() });
});

export const POST = handler(async (req: Request) => {
  await ensureDemoParties();
  const body = await readJson<{ brandId?: string; creatorId?: string; title?: string }>(req).catch(() => ({}) as { brandId?: string; creatorId?: string; title?: string });
  const id = await createDraftDeal({
    brandId: body.brandId ?? DEMO_BRAND_ID,
    creatorId: body.creatorId ?? DEMO_CREATOR_ID,
    title: body.title ?? "New deal",
    terms: emptyTerms(),
  });
  return ok({ id }, { status: 201 });
});

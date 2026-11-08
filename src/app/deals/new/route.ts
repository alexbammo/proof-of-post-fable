import { NextResponse } from "next/server";
import { createDraftDeal } from "@/lib/deals";
import { emptyTerms } from "@/lib/ai/deal-builder";
import { ensureDemoParties, DEMO_BRAND_ID, DEMO_CREATOR_ID } from "@/lib/parties";

export async function GET(req: Request) {
  await ensureDemoParties();
  const id = await createDraftDeal({ brandId: DEMO_BRAND_ID, creatorId: DEMO_CREATOR_ID, title: "New deal", terms: emptyTerms() });
  return NextResponse.redirect(new URL(`/deals/${id}`, process.env.APP_URL ?? req.url));
}

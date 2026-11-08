import { handler, ok, bad, readJson } from "@/lib/http";
import { getDb, schema } from "@/lib/db";
import { getDealFull, updateDraftTerms } from "@/lib/deals";
import { buildDeal, type BuilderTurn } from "@/lib/ai/deal-builder";
import { aiConfigured } from "@/lib/ai/client";
import { newId } from "@/lib/ids";
import { audit } from "@/lib/audit";

// POST { role: "brand"|"creator", content } → appends the message, runs the deal builder,
// stores the assistant reply and the updated draft terms.
export const POST = handler(async (req: Request, ctx: RouteContext<"/api/deals/[id]/chat">) => {
  const { id } = await ctx.params;
  const body = await readJson<{ role: "brand" | "creator"; content: string }>(req);
  if (!body.content?.trim() || !["brand", "creator"].includes(body.role)) return bad("role and content required");

  const full = await getDealFull(id);
  if (!full) return bad("deal not found", 404);
  if (full.deal.status !== "draft") return bad("deal terms are locked once accepted");

  const db = await getDb();
  await db.insert(schema.chatMessages).values({ id: newId("msg"), dealId: id, role: body.role, content: body.content.trim() });

  if (!aiConfigured()) {
    const reply = "AI is not configured on this server yet (no API key). Terms can still be edited by hand.";
    await db.insert(schema.chatMessages).values({ id: newId("msg"), dealId: id, role: "assistant", content: reply });
    return ok({ reply, terms: full.deal.terms, missing: [], readyToAccept: false, aiConfigured: false });
  }

  const history: BuilderTurn[] = [...full.messages.map((m) => ({ role: m.role as BuilderTurn["role"], content: m.content })), { role: body.role, content: body.content.trim() }];
  const out = await buildDeal(history, full.brand.name, full.creator.name);

  await db.insert(schema.chatMessages).values({ id: newId("msg"), dealId: id, role: "assistant", content: out.reply });
  await updateDraftTerms(id, out.terms, (full.brand.tier as "starter") ?? "starter");
  await audit(id, "ai:deal-builder", "terms:drafted", { missing: out.missing, readyToAccept: out.readyToAccept, priceUsd: out.terms.priceUsd });

  return ok({ ...out, aiConfigured: true });
});

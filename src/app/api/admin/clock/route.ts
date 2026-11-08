import { eq } from "drizzle-orm";
import { handler, ok, bad, readJson, requireAdmin } from "@/lib/http";
import { getDb, schema } from "@/lib/db";
import { getDeal } from "@/lib/deals";
import { audit } from "@/lib/audit";

// DEMO CLOCK ("time warp"). Advances one deal's clock by N days and runs its re-check immediately.
// Clearly a demo control: it only shifts the per-deal offset used by dealDay(); nothing else changes.
export const POST = handler(async (req: Request) => {
  requireAdmin(req);
  const body = await readJson<{ dealId: string; days: number }>(req);
  const deal = await getDeal(body.dealId);
  if (!deal) return bad("deal not found", 404);
  const days = Math.max(0, Math.min(60, Math.floor(body.days ?? 0)));
  const db = await getDb();
  await db.update(schema.deals).set({ clockOffsetDays: deal.clockOffsetDays + days, updatedAt: new Date() }).where(eq(schema.deals.id, deal.id));
  await audit(deal.id, "admin", "demo:time_warp", { addedDays: days, offsetNow: deal.clockOffsetDays + days });

  // Run the re-check through the same route the scheduler uses.
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const r = await fetch(`${base}/api/deals/${deal.id}/recheck`, { method: "POST" });
  const result = await r.json().catch(() => ({}));
  return ok({ offsetDays: deal.clockOffsetDays + days, recheck: result });
});

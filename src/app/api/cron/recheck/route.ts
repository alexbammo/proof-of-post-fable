import { inArray } from "drizzle-orm";
import { handler, ok, requireAdmin } from "@/lib/http";
import { getDb, schema } from "@/lib/db";

// Daily scheduler entry point (Render cron job hits this). Re-checks every deal with a pending capture, waiting for a post, live, or in a fix window.
export const POST = handler(async (req: Request) => {
  requireAdmin(req);
  const db = await getDb();
  const live = await db.select({ id: schema.deals.id }).from(schema.deals).where(inArray(schema.deals.status, ["agreed", "awaiting_post", "live_checking", "partially_released", "fix_window"]));
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  const results: Record<string, unknown> = {};
  for (const d of live) {
    const r = await fetch(`${base}/api/deals/${d.id}/recheck`, { method: "POST" });
    results[d.id] = await r.json().catch(() => ({ error: "bad json" }));
  }
  return ok({ checked: live.length, results });
});

export const GET = POST;

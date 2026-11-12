import { and, inArray } from "drizzle-orm";
import { handler, ok, bad, readJson, requireAdmin } from "@/lib/http";
import { getDb, schema } from "@/lib/db";
import { emptyTerms } from "@/lib/ai/deal-builder";

// Key-order-insensitive compare, so a stored jsonb value matches a freshly built object.
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.entries(v as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, x]) => `${JSON.stringify(k)}:${canon(x)}`)
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

// DEMO HOUSEKEEPING. Removes deals that never took money: untouched drafts (terms still the
// starting terms and no chat), or named deals that are still draft or agreed. A deal with any
// payment row is never deleted, so no money record is lost.
export const POST = handler(async (req: Request) => {
  requireAdmin(req);
  const body = await readJson<{ dealIds?: string[]; emptyDrafts?: boolean }>(req);
  const named = Array.isArray(body.dealIds) ? body.dealIds.filter((x) => typeof x === "string") : [];
  if (!body.emptyDrafts && !named.length) return bad("pass emptyDrafts: true or dealIds", 400);
  const db = await getDb();
  const blank = canon(emptyTerms());

  const result = await db.transaction(async (tx) => {
    // Lock the candidate rows, then decide, so an edit or a payment cannot slip in between.
    const rows = await tx
      .select()
      .from(schema.deals)
      .where(inArray(schema.deals.status, ["draft", "agreed"]))
      .for("update");
    const rowIds = rows.map((d) => d.id);
    if (!rowIds.length) return { deleted: [] as string[], keptBecausePaid: [] as string[] };
    const chatted = new Set(
      (await tx.select({ dealId: schema.chatMessages.dealId }).from(schema.chatMessages).where(inArray(schema.chatMessages.dealId, rowIds))).map((m) => m.dealId),
    );
    const paid = new Set(
      (await tx.select({ dealId: schema.payments.dealId }).from(schema.payments).where(inArray(schema.payments.dealId, rowIds))).map((p) => p.dealId),
    );

    const wanted = rows.filter(
      (d) => named.includes(d.id) || (body.emptyDrafts && d.status === "draft" && !chatted.has(d.id) && canon(d.terms) === blank),
    );
    const doomed = wanted.filter((d) => !paid.has(d.id)).map((d) => d.id);
    const keptBecausePaid = wanted.filter((d) => paid.has(d.id)).map((d) => d.id);
    if (doomed.length) {
      await tx.delete(schema.checks).where(inArray(schema.checks.dealId, doomed));
      await tx.delete(schema.posts).where(inArray(schema.posts.dealId, doomed));
      await tx.delete(schema.disputes).where(inArray(schema.disputes.dealId, doomed));
      await tx.delete(schema.chatMessages).where(inArray(schema.chatMessages.dealId, doomed));
      await tx.delete(schema.auditEvents).where(inArray(schema.auditEvents.dealId, doomed));
      await tx.delete(schema.deals).where(and(inArray(schema.deals.id, doomed), inArray(schema.deals.status, ["draft", "agreed"])));
    }
    return { deleted: doomed, keptBecausePaid };
  });
  if (!result.deleted.length) return bad("nothing to delete", 404);
  return ok(result);
});

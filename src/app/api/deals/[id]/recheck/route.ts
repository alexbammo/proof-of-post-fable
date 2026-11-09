import { eq } from "drizzle-orm";
import { handler, ok, bad } from "@/lib/http";
import { getDb, schema } from "@/lib/db";
import { getDeal, dealDay, dealNow, setStatus } from "@/lib/deals";
import { runCheck, latestPost } from "@/lib/checker";
import { releaseToCreator, releasePlanFor, closeFailedDeal, finishDeal, reconcilePendingCapture } from "@/lib/payments";
import { audit } from "@/lib/audit";

// One scheduled re-check for a deal. Called by the cron route for every active deal, and by the admin
// time-warp control. Opens a fix window when the post deadline passes, releases the go-live stage when a
// fix succeeds, releases the rest when the stay-up period completes, refunds (or marks disputed if the creator
// was already paid) when a fix window lapses.
export const POST = handler(async (_req: Request, ctx: RouteContext<"/api/deals/[id]/recheck">) => {
  const { id } = await ctx.params;
  const deal = await getDeal(id);
  if (!deal) return bad("deal not found", 404);
  const now = dealNow(deal);

  if (deal.status === "agreed") {
    // Paid but the capture came back PENDING: ask PayPal whether it has completed since.
    const r = await reconcilePendingCapture(id);
    return ok({ action: r === "completed" ? "capture_completed" : "noop", capture: r, status: (await getDeal(id))!.status });
  }

  if (deal.status === "awaiting_post") {
    // No post yet. Once the agreed post-by date has passed, give the creator a 48h fix window, then refund.
    const deadline = deal.terms.postBy ? new Date(`${deal.terms.postBy}T23:59:59Z`) : null;
    if (deadline && now > deadline) {
      const ends = new Date(now.getTime() + 48 * 3_600_000);
      const db = await getDb();
      await db.update(schema.deals).set({ fixWindowEndsAt: ends }).where(eq(schema.deals.id, id));
      await setStatus(id, "fix_window", "system", { reason: "post deadline passed without a post", postBy: deal.terms.postBy, fixWindowEndsAt: ends.toISOString() });
      return ok({ action: "deadline_passed", fixWindowEndsAt: ends });
    }
    return ok({ action: "noop", status: deal.status });
  }

  if (deal.status === "fix_window") {
    const ends = deal.fixWindowEndsAt?.getTime() ?? 0;
    if (now.getTime() < ends) return ok({ action: "fix_window_open", endsAt: deal.fixWindowEndsAt });

    // Time's up: one last look (if there is a post at all), then refund if still failing.
    const post = await latestPost(id);
    if (!post) {
      const r = await closeFailedDeal(id, "post deadline and fix window passed without a post");
      return ok({ action: r.outcome, ...(r.outcome === "refunded" ? { refund: r.refund } : {}) });
    }
    const last = await runCheck(id, "fix_recheck");
    if (last.verdict?.verdict === "fail") {
      const r = await closeFailedDeal(id, "fix window expired without a passing post");
      return ok({ action: r.outcome, verdict: last.verdict, ...(r.outcome === "refunded" ? { refund: r.refund } : {}) });
    }
    if (last.verdict?.verdict !== "pass") {
      // needs_review (or no verdict): never refund on ambiguity. The admin review queue shows the deal.
      return ok({ action: "needs_review", verdict: last.verdict });
    }
    // Passed inside the fix window: the deal is live again, so the go-live stage is owed.
    const r = await releaseToCreator(id, releasePlanFor(deal, "go_live"), "post fixed and verified");
    return ok({ action: "passed_in_fix_window", verdict: last.verdict, releasedCents: r.amountCents });
  }

  if (!["live_checking", "partially_released"].includes(deal.status)) return ok({ action: "noop", status: deal.status });

  const outcome = await runCheck(id, "recheck");
  const day = dealDay(deal);
  const done = day >= deal.terms.stayUpDays;

  if (outcome.verdict?.verdict === "pass" && done) {
    const r = await finishDeal(id, `stay-up period of ${deal.terms.stayUpDays} days complete`);
    await audit(id, "system", "deal:complete", { day });
    return ok({ action: "released_final", day, releasedCents: r.amountCents, verdict: outcome.verdict, skipped: outcome.skipped });
  }
  return ok({ action: outcome.verdict?.verdict ?? "unknown", day, skipped: outcome.skipped, model: outcome.model, verdict: outcome.verdict });
});

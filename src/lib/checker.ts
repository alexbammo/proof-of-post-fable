import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Deal, Post, Verdict } from "@/lib/db/schema";
import { getAdapter, type PostSnapshot } from "@/lib/platforms";
import { manualAdapter } from "@/lib/platforms/manual";
import { checkPost, snapshotChanged } from "@/lib/ai/verdict";
import { aiConfigured } from "@/lib/ai/client";
import { getDeal, dealDay, recordCheck, setStatus } from "@/lib/deals";
import { audit } from "@/lib/audit";

// Orchestrates one check of a deal's post:
//   fetch snapshot via adapter → (recheck: diff first, skip AI if unchanged) → AI verdict → record → move the deal.
// Payment release/refund is triggered by the caller (routes/payments.ts) based on the returned verdict,
// so this module stays free of PayPal concerns and can run in tests without a sandbox.

export interface CheckOutcome {
  checkId: string;
  verdict: Verdict | null;
  snapshot: PostSnapshot;
  skipped: boolean; // recheck with no change → no AI call
  model: string;
}

export async function fetchSnapshot(post: Post): Promise<PostSnapshot> {
  if (post.platform === "manual") {
    const ref = post.ref as { captionText?: string; screenshotPath?: string };
    return manualAdapter.fromSubmission({
      url: post.url,
      captionText: ref.captionText ?? "",
      screenshotPath: post.screenshotPath ?? ref.screenshotPath ?? "",
    });
  }
  const adapter = getAdapter(post.platform as PostSnapshot["platform"]);
  return adapter.fetch(post.ref as Parameters<typeof adapter.fetch>[0]);
}

async function latestCheck(dealId: string) {
  const db = await getDb();
  const rows = await db.select().from(schema.checks).where(eq(schema.checks.dealId, dealId)).orderBy(desc(schema.checks.createdAt)).limit(1);
  return rows[0] ?? null;
}

export async function latestPost(dealId: string) {
  const db = await getDb();
  const rows = await db.select().from(schema.posts).where(eq(schema.posts.dealId, dealId)).orderBy(desc(schema.posts.submittedAt)).limit(1);
  return rows[0] ?? null;
}

export async function runCheck(dealId: string, kind: "initial" | "recheck" | "fix_recheck"): Promise<CheckOutcome> {
  const deal = await getDeal(dealId);
  if (!deal) throw new Error("deal not found");
  const post = await latestPost(dealId);
  if (!post) throw new Error("no post submitted for this deal");

  const snapshot = await fetchSnapshot(post);
  const day = dealDay(deal);

  // Re-checks: plain code first. Only spend a model call if something material changed.
  if (kind === "recheck") {
    const prev = await latestCheck(dealId);
    const prevSnap = prev?.snapshot as PostSnapshot | null;
    if (prevSnap) {
      const diff = snapshotChanged(prevSnap, snapshot);
      if (!diff.changed) {
        const carried = prev?.verdict ?? null;
        const checkId = await recordCheck({ dealId, postId: post.id, kind, dealDay: day, snapshot, verdict: carried, model: "code", changed: false });
        return { checkId, verdict: carried, snapshot, skipped: true, model: "code" };
      }
      await audit(dealId, "system", "recheck:changed", { reasons: diff.reasons });
    }
  }

  let verdict: Verdict;
  let model = "none";
  if (!snapshot.isLive) {
    // No need to ask a model whether a deleted post meets the terms.
    verdict = {
      verdict: "fail",
      checks: [{ term: "live", ok: false, evidence: `isLive=false (${JSON.stringify((snapshot.raw as { gone?: string })?.gone ?? "not found")})`, note: "The post is no longer available on the platform." }],
      summary: "The post has been removed or is no longer public, so it no longer meets the deal terms.",
      confidence: 0.98,
    };
    model = "code";
  } else if (!aiConfigured()) {
    verdict = {
      verdict: "needs_review",
      checks: [],
      summary: "AI checking is not configured on this server (no API key), so this post needs a human review.",
      confidence: 0,
    };
    model = "unconfigured";
  } else {
    const imageUrls = snapshot.media.filter((m) => m.kind !== "video").map((m) => m.url).filter((u) => /^https?:\/\//.test(u));
    const result = await checkPost({ terms: deal.terms, snapshot, imageUrls, kind: kind === "recheck" ? "recheck" : "initial" });
    verdict = result.verdict;
    model = result.model;
  }

  const checkId = await recordCheck({ dealId, postId: post.id, kind, dealDay: day, snapshot, verdict, model, changed: kind === "recheck" ? true : undefined });
  await applyVerdictToDeal(deal, verdict, kind);
  return { checkId, verdict, snapshot, skipped: false, model };
}

/** Move the deal's status to reflect the verdict. Money movement happens in the payments layer. */
async function applyVerdictToDeal(deal: Deal, verdict: Verdict, kind: "initial" | "recheck" | "fix_recheck") {
  const db = await getDb();
  const fresh = await getDeal(deal.id);
  if (!fresh) return;

  if (verdict.verdict === "pass") {
    if (fresh.status === "awaiting_post" || fresh.status === "fix_window") {
      await db.update(schema.deals).set({ goLiveAt: fresh.goLiveAt ?? new Date(), fixWindowEndsAt: null }).where(eq(schema.deals.id, deal.id));
      await setStatus(deal.id, "live_checking", "system", { via: kind });
    }
    return;
  }
  if (verdict.verdict === "fail") {
    if (fresh.status === "awaiting_post" || fresh.status === "live_checking" || fresh.status === "partially_released") {
      const ends = new Date(Date.now() + (fresh.terms.stayUpDays > 0 ? 48 : 24) * 3_600_000);
      await db.update(schema.deals).set({ fixWindowEndsAt: ends }).where(eq(schema.deals.id, deal.id));
      await setStatus(deal.id, "fix_window", "system", { via: kind, fixWindowEndsAt: ends.toISOString() });
    }
    return;
  }
  // needs_review: leave the status alone; the admin screen surfaces it.
  await audit(deal.id, "system", "review:requested", { confidence: verdict.confidence });
}

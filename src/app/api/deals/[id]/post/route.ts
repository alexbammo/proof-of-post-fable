import { handler, ok, bad, readJson } from "@/lib/http";
import { getDb, schema } from "@/lib/db";
import { getDeal } from "@/lib/deals";
import { resolveUrl } from "@/lib/platforms";
import { manualAdapter } from "@/lib/platforms/manual";
import { newId } from "@/lib/ids";
import { audit } from "@/lib/audit";
import { runCheck } from "@/lib/checker";
import { releaseToCreator, releasePlanFor } from "@/lib/payments";

// Creator submits the post link (or a manual link + caption + screenshot path). Runs the initial check immediately.
export const POST = handler(async (req: Request, ctx: RouteContext<"/api/deals/[id]/post">) => {
  const { id } = await ctx.params;
  const deal = await getDeal(id);
  if (!deal) return bad("deal not found", 404);
  if (!["awaiting_post", "fix_window"].includes(deal.status)) return bad(`Deal is not waiting for a post (is ${deal.status})`);

  const body = await readJson<{ url: string; manual?: { captionText: string; screenshotPath: string } }>(req);
  if (!body.url) return bad("url required");

  let ref = await resolveUrl(body.url, false);
  let platform = ref?.platform;
  let trust: "platform" | "manual" = "platform";
  let storedRef: unknown = ref;
  if (!ref) {
    if (!body.manual) return bad("Link not recognised. Only YouTube, Twitch and Bluesky links are checked automatically; use the manual option.");
    const m = await manualAdapter.resolve(body.url);
    if (!m) return bad("invalid url");
    ref = m;
    platform = "manual";
    trust = "manual";
    storedRef = { ...m, captionText: body.manual.captionText, screenshotPath: body.manual.screenshotPath };
  }

  const db = await getDb();
  const postId = newId("post");
  await db.insert(schema.posts).values({
    id: postId,
    dealId: id,
    platform: platform!,
    url: ref!.url,
    ref: storedRef,
    trust,
    screenshotPath: body.manual?.screenshotPath ?? null,
  });
  await audit(id, `creator:${deal.creatorId}`, "post:submitted", { platform, url: ref!.url, trust });

  const outcome = await runCheck(id, deal.status === "fix_window" ? "fix_recheck" : "initial");

  // On a pass at go-live, release the go-live stage.
  let released = 0;
  if (outcome.verdict?.verdict === "pass") {
    const pct = releasePlanFor(deal, "go_live");
    if (pct > 0) {
      try {
        released = (await releaseToCreator(id, pct, "post verified at go-live")).amountCents;
      } catch (e) {
        await audit(id, "system", "payment:release_failed", { error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return ok({ postId, checkId: outcome.checkId, verdict: outcome.verdict, releasedCents: released });
});

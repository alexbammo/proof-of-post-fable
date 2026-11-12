// Dry-run the checker on one YouTube URL against the demo tea terms. No deal, no money.
// Usage: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/check-url.ts <youtube url>
import { youtubeAdapter } from "../src/lib/platforms/youtube";
import { checkPost } from "../src/lib/ai/verdict";
import { emptyTerms } from "../src/lib/ai/deal-builder";
import type { DealTerms } from "../src/lib/db/schema";

const terms: DealTerms = {
  ...emptyTerms(),
  platform: "youtube",
  creatorAccount: "alex-v7l8b",
  deliverable: "1 YouTube video featuring Nimbus Tea Co.'s new oat-milk chai",
  postBy: "2026-11-20",
  stayUpDays: 7,
  requiredHashtags: ["#ad", "#NimbusTea"],
  priceUsd: 250,
  notes: "Hashtags must appear in the video description.",
};

async function main() {
  const ref = await youtubeAdapter.resolve(process.argv[2]);
  if (!ref) throw new Error("not a youtube url");
  const snap = await youtubeAdapter.fetch(ref);
  console.log("post:", snap.url, "| author", snap.author.handle, "| tags", snap.tags, "| live", snap.isLive, "| disclosure", JSON.stringify(snap.disclosure));
  const r = await checkPost({ terms, snapshot: snap, kind: "initial" });
  const v = r.verdict;
  console.log(`verdict=${v.verdict} confidence=${v.confidence} injection=${v.injectionDetected} model=${r.model}`);
  for (const c of v.checks) console.log(`  [${c.ok ? "ok " : "NO "}] ${c.term}: ${c.note} | evidence: ${JSON.stringify(c.evidence).slice(0, 140)}`);
  console.log("  summary:", v.summary);
}
main().catch((e) => { console.error(e); process.exit(1); });

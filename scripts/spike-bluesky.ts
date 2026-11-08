// Day-1 spike: resolve + fetch a public Bluesky post through the adapter.
// Usage: pnpm tsx scripts/spike-bluesky.ts <bsky.app post url>
import { blueskyAdapter } from "../src/lib/platforms/bluesky";

async function main() {
  let url = process.argv[2];
  if (!url) {
    // Pick the latest post from the official @bsky.app account so the spike needs no input.
    const r = await fetch("https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=bsky.app&limit=1&filter=posts_no_replies");
    const j = (await r.json()) as { feed: { post: { uri: string; author: { handle: string } } }[] };
    const p = j.feed[0].post;
    url = `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split("/").pop()}`;
    console.log("No URL given, using latest @bsky.app post:", url);
  }
  const ref = await blueskyAdapter.resolve(url);
  console.log("ref:", ref);
  if (!ref) throw new Error("not a bluesky url");
  const snap = await blueskyAdapter.fetch(ref);
  console.log(JSON.stringify(snap, null, 2));
  // Deleted-post path: a made-up rkey must come back isLive=false, not throw.
  const gone = await blueskyAdapter.fetch({ ...ref, id: ref.id.replace(/[^/]+$/, "3zzzzzzzzzzzz") });
  console.log("deleted-post path isLive =", gone.isLive, gone.raw);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

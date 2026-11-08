// Exercise the YouTube and Twitch adapters end to end, including the gone paths.
// Usage: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/spike-adapters.ts
import { resolveUrl, getAdapter, type PostSnapshot } from "../src/lib/platforms";

function show(s: PostSnapshot) {
  const trimmed = { ...s, text: s.text.slice(0, 120) + (s.text.length > 120 ? "…" : "") };
  console.log(JSON.stringify(trimmed, null, 1).replace(/\n\s*/g, " "));
}

async function main() {
  for (const url of [
    "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    "https://youtu.be/jNQXAC9IVRw?t=3",
    "https://www.youtube.com/watch?v=zzzzzzzzzzz", // not a real video → gone
    "https://www.twitch.tv/videos/2915087502",
    "https://www.twitch.tv/twitch",
    "https://www.twitch.tv/videos/1", // long-gone VOD → gone
    "https://example.com/not-a-platform",
  ]) {
    const ref = await resolveUrl(url);
    console.log("\n" + url, "→", ref);
    if (!ref) continue;
    show(await getAdapter(ref.platform).fetch(ref));
  }
}
main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});

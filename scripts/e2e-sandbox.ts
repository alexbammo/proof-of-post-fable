// Drive the app's own HTTP API through a sandbox deal, step by step.
//   setup [bsky post url]         link the demo creator, create a deal, chat once with the AI builder, set terms,
//                                 accept both sides, start checkout → prints the PayPal approve URL (buyer logs in there)
//   status <dealId>               print deal status, payments and audit tail
//   post <dealId> <url>           creator submits the post → initial check (and go-live release on a pass)
//   warp <dealId> <days>          demo clock: jump N days and run the re-check (needs ADMIN_TOKEN)
//   recheck <dealId>              run the re-check now
// Usage: node --env-file=.env.local node_modules/tsx/dist/cli.mjs scripts/e2e-sandbox.ts <command> ...
const BASE = process.env.APP_URL ?? "http://localhost:3002";
const CREATOR_EMAIL = process.env.E2E_CREATOR_PAYPAL_EMAIL ?? "sb-ihmpl53787724@business.example.com"; // demo seller (sandbox)

async function api(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function latestBskyPost(): Promise<{ url: string; handle: string }> {
  const r = await fetch("https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=bsky.app&limit=1&filter=posts_no_replies");
  const j = (await r.json()) as { feed: { post: { uri: string; author: { handle: string } } }[] };
  const p = j.feed[0].post;
  return { url: `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split("/").pop()}`, handle: p.author.handle };
}

async function setup(postUrl?: string) {
  const link = await api("POST", "/api/creators/creator_demo/onboard", { paypalEmail: CREATOR_EMAIL });
  console.log("creator linked:", link);

  const { id } = await api("POST", "/api/deals", { title: "E2E sandbox deal" });
  console.log("deal:", id);

  // One real turn through the AI deal builder, to verify it end to end.
  const chat = await api("POST", `/api/deals/${id}/chat`, {
    role: "brand",
    content: "Hi Maya. We'd like one Bluesky post about our new oat-milk chai, by this Wednesday, $50, must include #ad and link to nimbustea.example/chai. 7 days stay-up, pay 50% on go-live and 50% after.",
  });
  console.log("builder reply:", chat.reply);
  console.log("builder terms:", JSON.stringify(chat.terms));

  // Deterministic terms for the money path: match whatever live post we will submit.
  let handle = "maya.films";
  if (!postUrl) {
    const p = await latestBskyPost();
    postUrl = p.url;
    handle = p.handle;
  } else {
    const m = postUrl.match(/\/profile\/([^/]+)\/post\//);
    if (m) handle = m[1];
  }
  const terms = await api("PUT", `/api/deals/${id}/terms`, {
    platform: "bluesky",
    creatorAccount: handle,
    deliverable: "One Bluesky post from the creator's account (sandbox end-to-end test)",
    postBy: "2026-12-31",
    stayUpDays: 7,
    requiredMentions: [],
    requiredHashtags: [],
    requiredLinks: [],
    disclosureRequired: false,
    minViews: null,
    priceUsd: 50,
    payoutSchedule: { atGoLivePct: 50, afterStayUpPct: 50 },
    notes: "sandbox e2e",
  });
  console.log("terms set; price", terms.terms.priceUsd);

  console.log("accept brand:", await api("POST", `/api/deals/${id}/accept`, { side: "brand" }));
  console.log("accept creator:", await api("POST", `/api/deals/${id}/accept`, { side: "creator" }));

  const pay = await api("POST", `/api/deals/${id}/pay`);
  console.log("\nPayPal order:", pay.orderId);
  console.log("APPROVE URL (log in as the sandbox BUYER):", pay.approveUrl);
  console.log("post to submit after payment:", postUrl);
  console.log(`\nthen: ... e2e-sandbox.ts post ${id} ${postUrl}`);
}

async function showStatus(id: string) {
  const { deals } = await api("GET", "/api/deals");
  const d = deals.find((x: { id: string }) => x.id === id);
  console.log(JSON.stringify({ status: d?.status, priceCents: d?.priceCents, brandTotalCents: d?.brandTotalCents, releasedCents: d?.releasedCents, refundedCents: d?.refundedCents, clockOffsetDays: d?.clockOffsetDays, goLiveAt: d?.goLiveAt, fixWindowEndsAt: d?.fixWindowEndsAt }, null, 1));
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "setup") return setup(a);
  if (cmd === "status") return showStatus(a);
  if (cmd === "post") {
    const r = await api("POST", `/api/deals/${a}/post`, { url: b });
    console.log(JSON.stringify(r, null, 1));
    return showStatus(a);
  }
  if (cmd === "warp") {
    const r = await api("POST", `/api/admin/clock`, { dealId: a, days: Number(b) }, { "x-admin-token": process.env.ADMIN_TOKEN ?? "" });
    console.log(JSON.stringify(r, null, 1));
    return showStatus(a);
  }
  if (cmd === "recheck") {
    const r = await api("POST", `/api/deals/${a}/recheck`);
    console.log(JSON.stringify(r, null, 1));
    return showStatus(a);
  }
  console.log("commands: setup [bskyUrl] | status <id> | post <id> <url> | warp <id> <days> | recheck <id>");
}
main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});

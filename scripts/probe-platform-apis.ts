// Probe: confirm YouTube videos.list parts/fields and Twitch Helix client-credentials access. Prints no secrets.
async function youtube() {
  const key = process.env.YOUTUBE_API_KEY!;
  const id = process.argv[2] ?? "jNQXAC9IVRw"; // "Me at the zoo", public, oldest video on the platform
  const parts = "snippet,status,statistics,contentDetails,paidProductPlacementDetails";
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=${parts}&id=${id}&key=${key}`);
  const j = await r.json();
  if (!r.ok) { console.log("youtube status", r.status, JSON.stringify(j).replace(key, "<key>").slice(0, 400)); return; }
  const v = j.items?.[0];
  console.log("youtube ok; item keys:", v ? Object.keys(v) : "no items");
  console.log(" status:", v?.status);
  console.log(" paidProductPlacementDetails:", v?.paidProductPlacementDetails);
  console.log(" snippet.title:", v?.snippet?.title, "| channel:", v?.snippet?.channelTitle, v?.snippet?.channelId, "| publishedAt:", v?.snippet?.publishedAt);
  console.log(" snippet.tags:", v?.snippet?.tags?.slice(0, 5), "| thumb:", v?.snippet?.thumbnails?.high?.url);
  console.log(" statistics:", v?.statistics);
  // channel handle lookup
  const c = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${v?.snippet?.channelId}&key=${key}`);
  const cj = await c.json();
  console.log(" channel customUrl:", cj.items?.[0]?.snippet?.customUrl);
}
async function twitch() {
  const id = process.env.TWITCH_CLIENT_ID!, secret = process.env.TWITCH_CLIENT_SECRET!;
  const t = await fetch("https://id.twitch.tv/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }) });
  const tj = await t.json();
  if (!t.ok) { console.log("twitch token status", t.status, tj.message); return; }
  console.log("twitch token ok; expires_in", tj.expires_in);
  const h = { "client-id": id, authorization: `Bearer ${tj.access_token}` };
  const u = await (await fetch("https://api.twitch.tv/helix/users?login=twitch", { headers: h })).json();
  console.log(" users:", u.data?.[0]?.id, u.data?.[0]?.login, u.data?.[0]?.display_name);
  const vids = await (await fetch(`https://api.twitch.tv/helix/videos?user_id=${u.data?.[0]?.id}&first=1&type=archive`, { headers: h })).json();
  const v = vids.data?.[0];
  console.log(" latest archive VOD keys:", v ? Object.keys(v) : vids);
  if (v) console.log("  ", { id: v.id, title: v.title, url: v.url, created_at: v.created_at, published_at: v.published_at, duration: v.duration, view_count: v.view_count, type: v.type, thumbnail_url: v.thumbnail_url?.slice(0, 80) });
  const s = await (await fetch(`https://api.twitch.tv/helix/streams?user_login=twitch`, { headers: h })).json();
  console.log(" streams (live now?):", s.data?.length ? Object.keys(s.data[0]) : "offline");
  const ch = await (await fetch(`https://api.twitch.tv/helix/channels?broadcaster_id=${u.data?.[0]?.id}`, { headers: h })).json();
  console.log(" channel:", { title: ch.data?.[0]?.title, game: ch.data?.[0]?.game_name, tags: ch.data?.[0]?.tags, is_branded_content: ch.data?.[0]?.is_branded_content });
}
youtube().then(twitch).catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });

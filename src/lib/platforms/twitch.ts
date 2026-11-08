import type { PlatformAdapter, PostRef, PostSnapshot } from "./types";
import { extractTextSignals } from "./types";

// Twitch Helix with an app access token (client credentials). Two link shapes:
//   https://www.twitch.tv/videos/<vodId>   -> one past broadcast (VOD). Expires after 7/60 days.
//   https://www.twitch.tv/<channel>        -> the channel: the live stream if on air, else the latest archive VOD.
// Verified 8 Nov 2026: /helix/channels exposes is_branded_content (the paid-promotion flag) and tags[].

const HELIX = "https://api.twitch.tv/helix";

export function twitchConfigured() {
  return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

let token: { value: string; exp: number } | null = null;
async function appToken(): Promise<string> {
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) throw new Error("TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET are not set");
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`twitch token ${res.status}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.value;
}

async function helix<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${HELIX}/${path}?${qs}`, {
    headers: { "client-id": process.env.TWITCH_CLIENT_ID!, authorization: `Bearer ${await appToken()}` },
  });
  if (!res.ok) throw new Error(`twitch ${path} ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return (await res.json()) as T;
}

interface Video {
  id: string;
  stream_id: string | null;
  user_id: string;
  user_login: string;
  user_name: string;
  title: string;
  description: string;
  created_at: string;
  published_at: string;
  url: string;
  thumbnail_url: string;
  viewable: string;
  view_count: number;
  type: string;
  duration: string;
}
interface Stream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_name: string;
  title: string;
  viewer_count: number;
  started_at: string;
  thumbnail_url: string;
  tags?: string[];
}
interface Channel {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  game_name: string;
  title: string;
  tags?: string[];
  is_branded_content?: boolean;
}

const RESERVED = new Set(["videos", "directory", "p", "settings", "downloads", "search", "popout", "embed"]);

export const twitchAdapter: PlatformAdapter = {
  id: "twitch",

  async resolve(url) {
    let u: URL;
    try {
      u = new URL(url.trim());
    } catch {
      return null;
    }
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host !== "twitch.tv") return null;
    const vod = u.pathname.match(/^\/videos\/(\d+)\/?$/);
    if (vod) return { platform: "twitch", id: `vod:${vod[1]}`, url: `https://www.twitch.tv/videos/${vod[1]}` };
    const ch = u.pathname.match(/^\/([A-Za-z0-9_]{3,25})\/?$/);
    if (ch && !RESERVED.has(ch[1].toLowerCase())) {
      const login = ch[1].toLowerCase();
      return { platform: "twitch", id: `channel:${login}`, url: `https://www.twitch.tv/${login}`, authorHint: login };
    }
    return null;
  },

  async fetch(ref) {
    const fetchedAt = new Date().toISOString();
    const sep = ref.id.indexOf(":");
    const kind = ref.id.slice(0, sep);
    const value = ref.id.slice(sep + 1);

    let video: Video | undefined;
    let stream: Stream | undefined;
    let userId: string;

    if (kind === "vod") {
      const r = await helix<{ data: Video[] }>("videos", { id: value });
      video = r.data[0];
      if (!video) return gone(ref, fetchedAt, "vod not found (deleted or expired)");
      userId = video.user_id;
    } else {
      const users = await helix<{ data: { id: string; login: string; display_name: string }[] }>("users", { login: value });
      const user = users.data[0];
      if (!user) return gone(ref, fetchedAt, "channel not found");
      userId = user.id;
      const live = await helix<{ data: Stream[] }>("streams", { user_id: userId });
      stream = live.data[0];
      if (!stream) {
        const vods = await helix<{ data: Video[] }>("videos", { user_id: userId, type: "archive", first: "1" });
        video = vods.data[0];
        if (!video) return gone(ref, fetchedAt, "channel offline and no past broadcasts");
      }
    }

    const channel = (await helix<{ data: Channel[] }>("channels", { broadcaster_id: userId })).data[0];
    const title = stream?.title ?? video!.title;
    const description = video?.description ?? "";
    const text = [title, description].filter(Boolean).join("\n\n");
    const signals = extractTextSignals(text);
    const tags = [...(stream?.tags ?? channel?.tags ?? []), channel?.game_name ?? ""].filter(Boolean).map((t) => t.toLowerCase());
    const thumb = (stream?.thumbnail_url ?? video?.thumbnail_url ?? "")
      .replace("%{width}", "640")
      .replace("%{height}", "360")
      .replace("{width}", "640")
      .replace("{height}", "360");

    return {
      platform: "twitch",
      id: ref.id,
      url: stream ? `https://www.twitch.tv/${stream.user_login}` : video!.url,
      isLive: true,
      author: {
        id: userId,
        handle: stream?.user_login ?? video!.user_login,
        displayName: stream?.user_name ?? video!.user_name,
      },
      text,
      title,
      tags: Array.from(new Set([...signals.tags, ...tags])),
      links: signals.links,
      media: thumb ? [{ kind: "thumbnail", url: thumb }] : [],
      disclosure: { platformFlag: channel?.is_branded_content ?? null, textMarkers: signals.markers },
      metrics: { views: stream ? stream.viewer_count : video!.view_count },
      publishedAt: stream?.started_at ?? video!.published_at ?? video!.created_at,
      fetchedAt,
      trust: "platform",
      raw: {
        mode: stream ? "live" : "vod",
        vodId: video?.id,
        streamId: stream?.id ?? video?.stream_id,
        duration: video?.duration,
        game: stream?.game_name ?? channel?.game_name,
        viewable: video?.viewable,
      },
    };
  },

  async stillLive(ref) {
    return (await this.fetch(ref)).isLive;
  },
};

function gone(ref: PostRef, fetchedAt: string, why: string): PostSnapshot {
  return {
    platform: "twitch",
    id: ref.id,
    url: ref.url,
    isLive: false,
    author: { id: "", handle: ref.authorHint ?? "" },
    text: "",
    tags: [],
    links: [],
    media: [],
    disclosure: { platformFlag: null, textMarkers: [] },
    metrics: {},
    publishedAt: null,
    fetchedAt,
    trust: "platform",
    raw: { gone: why },
  };
}

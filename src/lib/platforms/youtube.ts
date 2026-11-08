import type { PlatformAdapter, PostRef, PostSnapshot } from "./types";
import { extractTextSignals } from "./types";

// YouTube Data API v3 with a plain API key (public videos only, no creator login).
// videos.list costs 1 quota unit; daily quota ~10k. Verified 8 Nov 2026: the paid-promotion flag is
// item.paidProductPlacementDetails.hasPaidProductPlacement, available with part=paidProductPlacementDetails.

const API = "https://www.googleapis.com/youtube/v3";

function key() {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error("YOUTUBE_API_KEY is not set");
  return k;
}

export function youtubeConfigured() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, key: key() }).toString();
  const res = await fetch(`${API}/${path}?${qs}`, { headers: { accept: "application/json" } });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).replaceAll(key(), "<key>");
    throw new Error(`youtube ${path} ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

interface VideoItem {
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    channelTitle: string;
    tags?: string[];
    thumbnails?: Record<string, { url: string }>;
    liveBroadcastContent?: string;
  };
  status: { uploadStatus: string; privacyStatus: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  paidProductPlacementDetails?: { hasPaidProductPlacement?: boolean };
}

/** Video id from the common URL shapes: watch?v=, youtu.be/, /shorts/, /live/, /embed/. */
export function parseYouTubeId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const ID = /^[A-Za-z0-9_-]{11}$/;
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return ID.test(id) ? id : null;
  }
  if (host !== "youtube.com" && host !== "music.youtube.com") return null;
  const v = u.searchParams.get("v");
  if (v && ID.test(v)) return v;
  const m = u.pathname.match(/^\/(?:shorts|live|embed|v)\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

const handleCache = new Map<string, string>();
async function channelHandle(channelId: string): Promise<string | undefined> {
  if (handleCache.has(channelId)) return handleCache.get(channelId);
  try {
    const r = await yt<{ items?: { snippet?: { customUrl?: string } }[] }>("channels", { part: "snippet", id: channelId });
    const h = r.items?.[0]?.snippet?.customUrl?.replace(/^@/, "");
    if (h) handleCache.set(channelId, h);
    return h;
  } catch {
    return undefined;
  }
}

export const youtubeAdapter: PlatformAdapter = {
  id: "youtube",

  async resolve(url) {
    const id = parseYouTubeId(url);
    if (!id) return null;
    return { platform: "youtube", id, url: `https://www.youtube.com/watch?v=${id}` };
  },

  async fetch(ref) {
    const fetchedAt = new Date().toISOString();
    const r = await yt<{ items?: VideoItem[] }>("videos", {
      part: "snippet,status,statistics,paidProductPlacementDetails",
      id: ref.id,
    });
    const v = r.items?.[0];
    // A deleted or private video is simply absent from items.
    if (!v || v.status.privacyStatus !== "public") return gone(ref, fetchedAt, v ? `privacy ${v.status.privacyStatus}` : "not found");

    const text = `${v.snippet.title}\n\n${v.snippet.description}`;
    const signals = extractTextSignals(text);
    const ytTags = (v.snippet.tags ?? []).map((t) => t.toLowerCase());
    const thumb = v.snippet.thumbnails?.maxres?.url ?? v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.default?.url;
    const handle = await channelHandle(v.snippet.channelId);

    return {
      platform: "youtube",
      id: v.id,
      url: `https://www.youtube.com/watch?v=${v.id}`,
      isLive: v.status.uploadStatus === "processed" || v.status.uploadStatus === "uploaded",
      author: { id: v.snippet.channelId, handle: handle ?? v.snippet.channelTitle, displayName: v.snippet.channelTitle },
      text,
      title: v.snippet.title,
      tags: Array.from(new Set([...signals.tags, ...ytTags])),
      links: signals.links,
      media: thumb ? [{ kind: "thumbnail", url: thumb }] : [],
      disclosure: {
        platformFlag: v.paidProductPlacementDetails?.hasPaidProductPlacement ?? false,
        textMarkers: signals.markers,
      },
      metrics: {
        views: num(v.statistics?.viewCount),
        likes: num(v.statistics?.likeCount),
        replies: num(v.statistics?.commentCount),
      },
      publishedAt: v.snippet.publishedAt,
      fetchedAt,
      trust: "platform",
      raw: { status: v.status, liveBroadcastContent: v.snippet.liveBroadcastContent, paid: v.paidProductPlacementDetails },
    };
  },

  async stillLive(ref) {
    return (await this.fetch(ref)).isLive;
  },
};

function num(s?: string) {
  return s === undefined ? undefined : Number(s);
}

function gone(ref: PostRef, fetchedAt: string, why: string): PostSnapshot {
  return {
    platform: "youtube",
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

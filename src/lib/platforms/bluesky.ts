import type { PlatformAdapter, PostRef, PostSnapshot, PostMedia } from "./types";
import { extractTextSignals } from "./types";

// Bluesky: fully public read API, no key required.
// Public AppView host (unauthenticated): https://public.api.bsky.app
// Post URL shape: https://bsky.app/profile/<handle-or-did>/post/<rkey>

const PUBLIC_API = "https://public.api.bsky.app/xrpc";

async function xrpc<T>(method: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${PUBLIC_API}/${method}?${qs}`, { headers: { accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`bluesky ${method} ${res.status}: ${body.slice(0, 200)}`) as Error & { status: number; body: string };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return (await res.json()) as T;
}

async function resolveHandle(handleOrDid: string): Promise<string> {
  if (handleOrDid.startsWith("did:")) return handleOrDid;
  const r = await xrpc<{ did: string }>("com.atproto.identity.resolveHandle", { handle: handleOrDid });
  return r.did;
}

interface ThreadResponse {
  thread: {
    $type: string; // app.bsky.feed.defs#threadViewPost | #notFoundPost | #blockedPost
    post?: {
      uri: string;
      cid: string;
      author: { did: string; handle: string; displayName?: string };
      record: { text?: string; createdAt?: string; facets?: Facet[]; tags?: string[] };
      embed?: Embed;
      replyCount?: number;
      repostCount?: number;
      likeCount?: number;
      quoteCount?: number;
      indexedAt: string;
      labels?: { val: string }[];
    };
  };
}
interface Facet {
  features: { $type: string; tag?: string; uri?: string; did?: string }[];
}
interface Embed {
  $type: string;
  images?: { thumb: string; fullsize: string; alt?: string }[];
  media?: Embed;
  external?: { uri: string; title?: string; description?: string; thumb?: string };
  playlist?: string;
  thumbnail?: string;
}

export const blueskyAdapter: PlatformAdapter = {
  id: "bluesky",

  async resolve(url) {
    let u: URL;
    try {
      u = new URL(url.trim());
    } catch {
      return null;
    }
    if (!/(^|\.)bsky\.app$/.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/profile\/([^/]+)\/post\/([^/]+)\/?$/);
    if (!m) return null;
    const [, actor, rkey] = m;
    const did = await resolveHandle(decodeURIComponent(actor));
    return {
      platform: "bluesky",
      id: `at://${did}/app.bsky.feed.post/${rkey}`,
      url: `https://bsky.app/profile/${actor}/post/${rkey}`,
      authorHint: actor,
    };
  },

  async fetch(ref) {
    const fetchedAt = new Date().toISOString();
    let data: ThreadResponse;
    try {
      data = await xrpc<ThreadResponse>("app.bsky.feed.getPostThread", { uri: ref.id, depth: "0", parentHeight: "0" });
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 400 || status === 404) return gone(ref, fetchedAt, `api ${status}`);
      throw e;
    }
    const t = data.thread;
    if (!t.post || t.$type.endsWith("#notFoundPost") || t.$type.endsWith("#blockedPost")) {
      return gone(ref, fetchedAt, t.$type);
    }
    const p = t.post;
    const text = p.record.text ?? "";
    const signals = extractTextSignals(text);

    // Facets are the structured tags/links the client rendered; merge them with the text scan.
    const facetTags: string[] = [];
    const facetLinks: string[] = [];
    for (const f of p.record.facets ?? []) {
      for (const feat of f.features) {
        if (feat.$type.endsWith("#tag") && feat.tag) facetTags.push(feat.tag.toLowerCase());
        if (feat.$type.endsWith("#link") && feat.uri) facetLinks.push(feat.uri);
      }
    }
    const selfLabelTags = (p.record.tags ?? []).map((x) => x.toLowerCase());

    const media: PostMedia[] = [];
    const collect = (e?: Embed) => {
      if (!e) return;
      for (const img of e.images ?? []) media.push({ kind: "image", url: img.fullsize, alt: img.alt });
      if (e.thumbnail) media.push({ kind: "thumbnail", url: e.thumbnail });
      if (e.external?.thumb) media.push({ kind: "thumbnail", url: e.external.thumb, alt: e.external.title });
      if (e.external?.uri) facetLinks.push(e.external.uri);
      collect(e.media);
    };
    collect(p.embed);

    return {
      platform: "bluesky",
      id: p.uri,
      url: `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split("/").pop()}`,
      isLive: true,
      author: { id: p.author.did, handle: p.author.handle, displayName: p.author.displayName },
      text,
      tags: Array.from(new Set([...signals.tags, ...facetTags, ...selfLabelTags])),
      links: Array.from(new Set([...signals.links, ...facetLinks])),
      media,
      disclosure: { platformFlag: null, textMarkers: signals.markers },
      metrics: { likes: p.likeCount, replies: p.replyCount, reposts: (p.repostCount ?? 0) + (p.quoteCount ?? 0) },
      publishedAt: p.record.createdAt ?? p.indexedAt,
      fetchedAt,
      trust: "platform",
      raw: { cid: p.cid, indexedAt: p.indexedAt, labels: p.labels, embedType: p.embed?.$type },
    };
  },

  async stillLive(ref) {
    const snap = await this.fetch(ref);
    return snap.isLive;
  },
};

function gone(ref: PostRef, fetchedAt: string, why: string): PostSnapshot {
  return {
    platform: "bluesky",
    id: ref.id,
    url: ref.url,
    isLive: false,
    author: { id: ref.id.split("/")[2] ?? "", handle: ref.authorHint ?? "" },
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

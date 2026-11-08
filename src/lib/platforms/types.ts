import type { Platform } from "@/lib/db/schema";

export interface PostRef {
  platform: Platform;
  id: string; // platform-native post id (video id, at-uri, VOD id, or manual hash)
  url: string; // canonical URL
  authorHint?: string; // handle / channel taken from the URL, if any
}

export interface PostMedia {
  kind: "image" | "video" | "thumbnail";
  url: string;
  alt?: string;
}

export interface PostSnapshot {
  platform: Platform;
  id: string;
  url: string;
  isLive: boolean;
  author: { id: string; handle: string; displayName?: string };
  text: string; // title + description / caption, as the platform exposes it
  title?: string;
  tags: string[]; // hashtags and platform tags, lower-case, without '#'
  links: string[];
  media: PostMedia[];
  disclosure: {
    platformFlag: boolean | null; // e.g. YouTube paid-promotion flag; null when the platform has no such field
    textMarkers: string[]; // "#ad", "#sponsored", "paid partnership" etc. found in text
  };
  metrics: { views?: number; likes?: number; replies?: number; reposts?: number };
  publishedAt: string | null; // ISO
  fetchedAt: string; // ISO
  trust: "platform" | "manual";
  raw?: unknown; // trimmed platform payload for the audit log
}

export interface PlatformAdapter {
  id: Platform;
  /** Parse a URL into a platform post reference, or null if the URL isn't for this platform. */
  resolve(url: string): Promise<PostRef | null>;
  /** Fetch the current state of the post. Must not throw on a deleted post: return isLive=false. */
  fetch(ref: PostRef): Promise<PostSnapshot>;
  stillLive(ref: PostRef): Promise<boolean>;
}

/** Shared helper: pull hashtags and disclosure markers out of free text. */
export function extractTextSignals(text: string) {
  const tags = Array.from(text.matchAll(/(?:^|[\s(\[])#([\p{L}\p{N}_]+)/gu)).map((m) => m[1].toLowerCase());
  const lower = text.toLowerCase();
  const markers: string[] = [];
  for (const m of ["#ad", "#advert", "#advertisement", "#sponsored", "#sponsor", "#paidpartnership", "#paidpromotion", "#gifted", "#partner"]) {
    if (new RegExp(`(^|[\\s(\\[])${m.replace("#", "#")}(?![\\p{L}\\p{N}_])`, "iu").test(text)) markers.push(m);
  }
  for (const phrase of ["paid partnership", "paid promotion", "sponsored by", "in partnership with", "includes paid promotion", "ad |"]) {
    if (lower.includes(phrase)) markers.push(phrase.trim());
  }
  const links = Array.from(text.matchAll(/https?:\/\/[^\s)\]]+/g)).map((m) => m[0]);
  return { tags: Array.from(new Set(tags)), markers: Array.from(new Set(markers)), links: Array.from(new Set(links)) };
}

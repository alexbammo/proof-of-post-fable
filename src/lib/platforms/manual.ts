import { createHash } from "node:crypto";
import type { PlatformAdapter, PostSnapshot } from "./types";
import { extractTextSignals } from "./types";

// Manual fallback: the creator pastes any link plus a screenshot and the caption text.
// Nothing is fetched from the platform, so the snapshot is marked trust="manual" and the
// UI shows it as lower trust. The AI reads the screenshot image directly.

export interface ManualSubmission {
  url: string;
  captionText: string;
  screenshotPath: string; // local path or URL the checker can read
}

export const manualAdapter: PlatformAdapter & {
  fromSubmission(sub: ManualSubmission): PostSnapshot;
} = {
  id: "manual",

  async resolve(url) {
    try {
      const u = new URL(url.trim());
      return {
        platform: "manual",
        id: "manual:" + createHash("sha1").update(u.toString()).digest("hex").slice(0, 16),
        url: u.toString(),
      };
    } catch {
      return null;
    }
  },

  // A manual post can't be re-fetched; callers use fromSubmission() with the stored submission.
  async fetch(ref) {
    return {
      platform: "manual",
      id: ref.id,
      url: ref.url,
      isLive: true,
      author: { id: "unknown", handle: ref.authorHint ?? "unknown" },
      text: "",
      tags: [],
      links: [],
      media: [],
      disclosure: { platformFlag: null, textMarkers: [] },
      metrics: {},
      publishedAt: null,
      fetchedAt: new Date().toISOString(),
      trust: "manual",
    };
  },

  async stillLive() {
    // We can't verify a manual post stays up without platform access.
    return true;
  },

  fromSubmission(sub) {
    const signals = extractTextSignals(sub.captionText);
    return {
      platform: "manual",
      id: "manual:" + createHash("sha1").update(sub.url).digest("hex").slice(0, 16),
      url: sub.url,
      isLive: true,
      author: { id: "unknown", handle: "unknown" },
      text: sub.captionText,
      tags: signals.tags,
      links: signals.links,
      media: [{ kind: "image", url: sub.screenshotPath, alt: "creator-supplied screenshot" }],
      disclosure: { platformFlag: null, textMarkers: signals.markers },
      metrics: {},
      publishedAt: null,
      fetchedAt: new Date().toISOString(),
      trust: "manual",
    };
  },
};

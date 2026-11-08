import type { Platform } from "@/lib/db/schema";
import type { PlatformAdapter, PostRef } from "./types";
import { blueskyAdapter } from "./bluesky";
import { manualAdapter } from "./manual";
import { youtubeAdapter } from "./youtube";
import { twitchAdapter } from "./twitch";

// Adapters register here.
const adapters: Partial<Record<Platform, PlatformAdapter>> = {
  youtube: youtubeAdapter,
  twitch: twitchAdapter,
  bluesky: blueskyAdapter,
  manual: manualAdapter,
};

export function getAdapter(platform: Platform): PlatformAdapter {
  const a = adapters[platform];
  if (!a) throw new Error(`No adapter for platform "${platform}"`);
  return a;
}

export function registerAdapter(a: PlatformAdapter) {
  adapters[a.id] = a;
}

/** Try every real platform adapter; fall back to manual only if asked. */
export async function resolveUrl(url: string, allowManual = false): Promise<PostRef | null> {
  for (const [id, a] of Object.entries(adapters)) {
    if (id === "manual") continue;
    const ref = await a!.resolve(url);
    if (ref) return ref;
  }
  return allowManual ? manualAdapter.resolve(url) : null;
}

export * from "./types";

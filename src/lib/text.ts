/** Cut a sentence to at most `max` characters at a word boundary, with an ellipsis. */
export function shortTitle(s: string, max = 64): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1); // leave room for the ellipsis
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[\s,;:(\-–]+$/, "") + "…";
}

const PLATFORM_NAMES: Record<string, string> = { youtube: "YouTube", twitch: "Twitch", bluesky: "Bluesky", manual: "Manual link" };
/** Display name for a stored platform key. */
export function platformName(key: string | null | undefined): string {
  if (!key) return "—";
  return Object.hasOwn(PLATFORM_NAMES, key) ? PLATFORM_NAMES[key] : key;
}

/** One date format for the whole UI: "11 Nov 2026, 21:16". Pass seconds for log rows. */
export function when(d: Date | string, seconds = false): string {
  return new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}) });
}

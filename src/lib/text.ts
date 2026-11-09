/** Cut a sentence to at most `max` characters at a word boundary, with an ellipsis. */
export function shortTitle(s: string, max = 64): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1); // leave room for the ellipsis
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[\s,;:(\-–]+$/, "") + "…";
}

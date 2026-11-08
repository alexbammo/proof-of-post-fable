import Anthropic from "@anthropic-ai/sdk";

// Models (fixed by the brief): Opus 5.5 for the deal builder and the main post check,
// Haiku 5.5 only for re-checks where something changed.
export const MODEL_MAIN = "claude-opus-5-5";
export const MODEL_RECHECK = "claude-haiku-5-5";

let client: Anthropic | null = null;

export function ai(): Anthropic {
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY
  return client;
}

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Server-side refusal fallback, on by default per the claude-api skill. */
export const FALLBACK_BETAS = ["server-side-fallback-2026-07-01"] as const;

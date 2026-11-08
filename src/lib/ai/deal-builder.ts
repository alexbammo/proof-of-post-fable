import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ai, MODEL_MAIN, FALLBACK_BETAS } from "./client";
import type { DealTerms } from "@/lib/db/schema";

// The deal builder: a brand and a creator chat in plain English; after each message the
// model returns (a) a short reply to the room and (b) the current best draft of the terms,
// with a flag saying whether the draft is complete enough to be accepted.

export const TermsSchema = z.object({
  platform: z.enum(["youtube", "twitch", "bluesky", "manual"]),
  creatorAccount: z.string().describe("Handle or channel the post must come from, without '@'. Empty if not yet known."),
  deliverable: z.string().describe("Plain-English description of the post, e.g. '1 YouTube video, 60s+ dedicated segment'."),
  postBy: z.string().describe("ISO date (YYYY-MM-DD) the post must be live by. Empty if not yet agreed."),
  stayUpDays: z.number().int().min(0),
  requiredMentions: z.array(z.string()),
  requiredHashtags: z.array(z.string()).describe("Each with the leading '#'."),
  requiredLinks: z.array(z.string()),
  disclosureRequired: z.boolean().describe("Default true: the post must carry #ad or an equivalent paid-promotion label."),
  minViews: z.number().int().nullable(),
  priceUsd: z.number().describe("What the creator receives, in USD. 0 if not yet agreed."),
  payoutSchedule: z
    .object({ atGoLivePct: z.union([z.literal(0), z.literal(100)]), afterStayUpPct: z.union([z.literal(0), z.literal(100)]) })
    .describe("Single stage only: either {100, 0} (paid when the post is verified) or {0, 100} (paid after the stay-up period)."),
  notes: z.string(),
});

export const BuilderOutputSchema = z.object({
  reply: z.string().describe("What the assistant says to the brand and creator next. One to four short sentences. Ask for at most one missing thing at a time."),
  terms: TermsSchema,
  missing: z.array(z.string()).describe("Which essentials are still missing or ambiguous: platform, creatorAccount, deliverable, postBy, priceUsd. Empty when complete."),
  readyToAccept: z.boolean(),
});
export type BuilderOutput = z.infer<typeof BuilderOutputSchema>;

const SYSTEM = `You are the deal builder for Proof of Post. A brand and a creator are agreeing a sponsored-post deal in plain English. Your job is to turn the conversation into fixed, checkable terms.

Rules:
- Keep a running draft of the terms. Fill in everything you can from the conversation; leave unknowns empty/0/null rather than inventing them.
- Essentials before a deal can be accepted: platform, creator account, deliverable, post-by date, price. Everything else has sensible defaults: disclosureRequired=true, stayUpDays=7, payoutSchedule 100% at go-live, or 100% after the stay-up period if either side asks to pay at the end. Split or staged payments (e.g. 50/50) are not available: if asked, say so briefly and offer the two options. requiredHashtags always includes "#ad" when disclosure is required.
- Prices: the price is what the creator receives. The brand pays the platform fee on top; you don't need to compute it.
- Dates: today's date is given in the first user message. Resolve relative dates ("next Friday") to ISO dates.
- Be brief, friendly and neutral between the two parties. Ask for at most one missing item per reply. When everything essential is present, summarise the terms in one or two sentences and say both sides can tap Accept.
- Never promise anything about payment timing beyond: funds are held by PayPal and released when the post passes the check.
- Platform names: youtube, twitch, bluesky. If the creator's platform is anything else (Instagram, TikTok, X...), explain that only YouTube, Twitch and Bluesky are checked automatically for now, and offer "manual" (creator uploads a screenshot, lower trust).`;

export interface BuilderTurn {
  role: "brand" | "creator" | "assistant";
  content: string;
}

export async function buildDeal(history: BuilderTurn[], brandName: string, creatorName: string): Promise<BuilderOutput> {
  const client = ai();
  const today = new Date().toISOString().slice(0, 10);

  // Collapse the two human roles into user turns, labelled, so the model knows who said what.
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  messages.push({ role: "user", content: `Today is ${today}. Brand: ${brandName}. Creator: ${creatorName}. The conversation follows.` });
  for (const t of history) {
    if (t.role === "assistant") messages.push({ role: "assistant", content: t.content });
    else messages.push({ role: "user", content: `[${t.role === "brand" ? brandName + " (brand)" : creatorName + " (creator)"}]: ${t.content}` });
  }
  if (messages[messages.length - 1].role === "assistant") messages.push({ role: "user", content: "(continue)" });

  const response = await client.beta.messages.parse({
    model: MODEL_MAIN,
    max_tokens: 4096,
    system: SYSTEM,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(BuilderOutputSchema) },
    betas: [...FALLBACK_BETAS],
    fallbacks: "default",
    messages,
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    return {
      reply: "I couldn't process that message. Could you rephrase the deal in a sentence or two?",
      terms: emptyTerms() as BuilderOutput["terms"],
      missing: ["platform", "creatorAccount", "deliverable", "postBy", "priceUsd"],
      readyToAccept: false,
    };
  }
  return response.parsed_output as BuilderOutput;
}

export function emptyTerms(): DealTerms {
  return {
    platform: "bluesky",
    creatorAccount: "",
    deliverable: "",
    postBy: "",
    stayUpDays: 7,
    requiredMentions: [],
    requiredHashtags: ["#ad"],
    requiredLinks: [],
    disclosureRequired: true,
    minViews: null,
    priceUsd: 0,
    payoutSchedule: { atGoLivePct: 100, afterStayUpPct: 0 },
    notes: "",
  };
}

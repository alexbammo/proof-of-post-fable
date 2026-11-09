import type { Deal } from "@/lib/db/schema";
import { dealDay } from "@/lib/deals";

// Where a deal is in its life, as five steps. Pure presentation; the state machine lives in src/lib/deals.ts.
const STEPS = ["Agree", "Pay", "Post", "Verify", "Settle"] as const;

type Tone = "ok" | "warn" | "bad" | "accent";

function describe(deal: Deal): { current: number; done: boolean; tone: Tone; note: string } {
  const s = deal.status;
  const stay = deal.terms.stayUpDays;
  switch (s) {
    case "draft":
      return { current: 0, done: false, tone: "accent", note: deal.brandAcceptedAt || deal.creatorAcceptedAt ? "One side has accepted; waiting for the other." : "Agree the terms in chat, then both sides accept." };
    case "agreed":
      return { current: 1, done: false, tone: "accent", note: "Terms locked. The brand pays through PayPal; the money is held, not paid out." };
    case "funded":
    case "awaiting_post":
      return { current: 2, done: false, tone: "accent", note: `PayPal is holding the money. The creator posts${deal.terms.postBy ? ` by ${deal.terms.postBy}` : ""} and pastes the link.` };
    case "live_checking":
    case "partially_released": {
      const day = dealDay(deal);
      return { current: 3, done: false, tone: "ok", note: `Post verified. Watching it daily: day ${Math.min(day, stay)} of ${stay}.` };
    }
    case "fix_window":
      return {
        current: 3,
        done: false,
        tone: "warn",
        note: `The check failed. The creator can fix the post${deal.fixWindowEndsAt ? ` until ${deal.fixWindowEndsAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : ""}; otherwise ${
          deal.releasedCents > 0 ? "the deal goes to a person for review (the creator has already been paid)" : "the brand is refunded"
        }.`,
      };
    case "disputed":
      return { current: 4, done: false, tone: "warn", note: "Needs a person: the creator was already paid and the post no longer passes." };
    case "released":
      return { current: 4, done: true, tone: "ok", note: "Paid. PayPal released the held money to the creator." };
    case "refunded":
      return { current: 4, done: true, tone: "bad", note: "Refunded. PayPal returned the brand's money in full." };
    default:
      return { current: 4, done: true, tone: "accent", note: "Closed." };
  }
}

const TONE = {
  ok: { dot: "bg-ok border-ok", text: "text-ok", ring: "ring-ok/30" },
  warn: { dot: "bg-warn border-warn", text: "text-warn", ring: "ring-warn/30" },
  bad: { dot: "bg-bad border-bad", text: "text-bad", ring: "ring-bad/30" },
  accent: { dot: "bg-accent border-accent", text: "text-accent", ring: "ring-accent/30" },
} as const;

export function DealProgress({ deal }: { deal: Deal }) {
  const { current, done, tone, note } = describe(deal);
  const t = TONE[tone];
  return (
    <section aria-label="Deal progress" className="rounded-2xl border border-border bg-card px-5 py-4">
      <ol className="grid grid-cols-5 gap-2">
        {STEPS.map((label, i) => {
          const isDone = i < current || (i === current && done);
          const isCurrent = i === current && !done;
          return (
            <li key={label} className="relative flex flex-col items-center text-center">
              {i > 0 ? <span aria-hidden className={`absolute left-[-50%] right-1/2 top-[7px] h-0.5 ${i <= current ? "bg-accent/70" : "bg-border"}`} /> : null}
              <span
                aria-hidden
                className={`relative z-10 inline-block size-4 rounded-full border-2 ${
                  isDone ? (i === current ? t.dot : "bg-accent border-accent") : isCurrent ? `bg-card ${t.dot.split(" ")[1]} ring-4 ${t.ring}` : "bg-card border-border"
                }`}
              />
              <span className={`mt-2 text-xs font-medium ${isCurrent ? t.text : isDone ? "text-foreground" : "text-muted"}`}>{label}</span>
            </li>
          );
        })}
      </ol>
      <p className={`mt-3 text-sm ${done || isWarn(tone) ? t.text : "text-foreground/80"}`}>{note}</p>
    </section>
  );
}

function isWarn(t: Tone) {
  return t === "warn" || t === "bad";
}

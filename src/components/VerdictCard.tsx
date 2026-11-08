import type { Check } from "@/lib/db/schema";
import type { PostSnapshot } from "@/lib/platforms/types";
import { VerdictChip } from "./StatusChip";

export function VerdictCard({ check, compact = false }: { check: Check; compact?: boolean }) {
  const v = check.verdict;
  const snap = check.snapshot as PostSnapshot | null;
  const when = new Date(check.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <VerdictChip verdict={v?.verdict} />
          <span className="text-sm font-medium capitalize">{check.kind.replace("_", " ")}</span>
          <span className="text-xs text-muted">day {check.dealDay}</span>
        </div>
        <div className="text-xs text-muted flex items-center gap-2">
          <span>{when}</span>
          <span className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono">{check.model === "code" ? "plain code" : check.model}</span>
          {check.changed === false ? <span className="rounded bg-foreground/5 px-1.5 py-0.5">unchanged, no AI call</span> : null}
          {snap?.trust === "manual" ? <span className="rounded bg-warn/10 text-warn px-1.5 py-0.5">lower trust: manual</span> : null}
        </div>
      </div>
      {v ? (
        <>
          <p className="mt-3 text-sm">{v.summary}</p>
          {v.injectionDetected ? (
            <p className="mt-2 text-sm text-bad">The post text tried to instruct the checker. It was treated as data and ignored.</p>
          ) : null}
          {!compact && v.checks.length ? (
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
              {v.checks.map((c, i) => (
                <li key={i} className="p-3 text-sm grid grid-cols-[1.25rem_1fr] gap-3">
                  <span aria-hidden className={`mt-0.5 inline-flex size-5 items-center justify-center rounded-full text-xs font-bold ${c.ok ? "bg-ok/15 text-ok" : "bg-bad/15 text-bad"}`}>
                    {c.ok ? "✓" : "✕"}
                  </span>
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium capitalize">{c.term}</span>
                    </div>
                    <p className="text-foreground/80">{c.note}</p>
                    {c.evidence ? <p className="mt-1 text-xs text-muted font-mono break-words">“{c.evidence}”</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs text-muted">Confidence {(v.confidence * 100).toFixed(0)}%</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">No verdict recorded.</p>
      )}
    </div>
  );
}

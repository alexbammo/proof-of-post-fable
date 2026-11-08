import type { DealStatus } from "@/lib/db/schema";

const META: Record<DealStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-foreground/5 text-foreground/70 border-border" },
  agreed: { label: "Agreed", cls: "bg-accent/10 text-accent border-accent/30" },
  funded: { label: "Funded · held", cls: "bg-hold/10 text-hold border-hold/30" },
  awaiting_post: { label: "Awaiting post", cls: "bg-hold/10 text-hold border-hold/30" },
  live_checking: { label: "Live · checking", cls: "bg-ok/10 text-ok border-ok/30" },
  partially_released: { label: "Part released", cls: "bg-ok/10 text-ok border-ok/30" },
  fix_window: { label: "Fix window", cls: "bg-warn/10 text-warn border-warn/30" },
  disputed: { label: "Under review", cls: "bg-warn/10 text-warn border-warn/30" },
  released: { label: "Released", cls: "bg-ok/15 text-ok border-ok/40" },
  refunded: { label: "Refunded", cls: "bg-bad/10 text-bad border-bad/30" },
  closed: { label: "Closed", cls: "bg-foreground/5 text-foreground/60 border-border" },
};

export function statusLabel(s: DealStatus) {
  return META[s]?.label ?? s;
}

export function StatusChip({ status, className = "" }: { status: DealStatus; className?: string }) {
  const m = META[status] ?? META.draft;
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.cls} ${className}`}>{m.label}</span>;
}

export function VerdictChip({ verdict }: { verdict: "pass" | "fail" | "needs_review" | null | undefined }) {
  if (!verdict) return <span className="text-xs text-muted">no verdict</span>;
  const map = {
    pass: "bg-ok/10 text-ok border-ok/30",
    fail: "bg-bad/10 text-bad border-bad/30",
    needs_review: "bg-warn/10 text-warn border-warn/30",
  } as const;
  const label = { pass: "Pass", fail: "Fail", needs_review: "Needs review" }[verdict];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[verdict]}`}>{label}</span>;
}

import type { Deal } from "@/lib/db/schema";
import { usd } from "@/lib/money";

const PLATFORM_LABEL = { youtube: "YouTube", twitch: "Twitch", bluesky: "Bluesky", manual: "Manual (screenshot)" } as const;

export function TermsCard({ deal }: { deal: Deal }) {
  const t = deal.terms;
  const rows: [string, React.ReactNode][] = [
    ["Platform", PLATFORM_LABEL[t.platform] ?? t.platform],
    ["Creator account", t.creatorAccount ? `@${t.creatorAccount}` : <Missing />],
    ["Deliverable", t.deliverable || <Missing />],
    ["Post by", t.postBy || <Missing />],
    ["Stays up", `${t.stayUpDays} day${t.stayUpDays === 1 ? "" : "s"}`],
    ["Must mention", t.requiredMentions.length ? t.requiredMentions.join(", ") : "—"],
    ["Hashtags", t.requiredHashtags.length ? t.requiredHashtags.join(" ") : "—"],
    ["Links", t.requiredLinks.length ? t.requiredLinks.join(", ") : "—"],
    ["Disclosure", t.disclosureRequired ? "#ad or paid-promotion label required" : "not required"],
    ["Minimum views", t.minViews ? t.minViews.toLocaleString() : "—"],
    [
      "Payout",
      t.payoutSchedule.afterStayUpPct > 0 ? `${t.payoutSchedule.atGoLivePct}% at go-live, ${t.payoutSchedule.afterStayUpPct}% after ${t.stayUpDays} days` : "100% when the post is verified",
    ],
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-medium">Deal terms</h3>
        <span className="text-xs text-muted">{deal.status === "draft" ? "draft, editable in chat" : "locked"}</span>
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right break-words">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 border-t border-border pt-4 grid grid-cols-2 gap-y-1.5 text-sm">
        <span className="text-muted">Creator receives</span>
        <span className="text-right font-medium">{t.priceUsd > 0 ? usd(deal.priceCents) : <Missing />}</span>
        <span className="text-muted">Platform fee</span>
        <span className="text-right">{usd(deal.platformFeeCents)}</span>
        <span className="text-muted">PayPal processing (est.)</span>
        <span className="text-right">{usd(deal.processingFeeCents)}</span>
        <span className="font-medium pt-1.5 border-t border-border">Brand pays</span>
        <span className="text-right font-semibold pt-1.5 border-t border-border">{usd(deal.brandTotalCents)}</span>
      </div>
      {t.notes ? <p className="mt-4 text-xs text-muted">{t.notes}</p> : null}
    </div>
  );
}

function Missing() {
  return <span className="text-warn">not yet agreed</span>;
}

import { TIERS } from "@/lib/money";

const FOR: Record<string, string> = {
  starter: "Small brands trying a few deals",
  growth: "Up to ~25 creators a month",
  pro: "Agencies: team seats, API",
  enterprise: "Global brands: #ad compliance audit reports, SSO, invoicing, mass payouts",
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-3 text-muted">
          The brand pays. <strong className="text-foreground">Creators pay nothing and keep 100%.</strong> You only pay when the post is proven. Half the cost of a manager, and no 10–15% taken from both sides.
        </p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(TIERS) as (keyof typeof TIERS)[]).map((k) => {
          const t = TIERS[k];
          return (
            <div key={k} className={`rounded-2xl border p-6 flex flex-col ${k === "growth" ? "border-accent bg-card shadow-sm" : "border-border bg-card"}`}>
              <div className="text-sm font-medium">{t.label}</div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">
                {t.monthlyUsd === null ? "from $60k" : t.monthlyUsd === 0 ? "Free" : `$${t.monthlyUsd}`}
                <span className="text-sm font-normal text-muted">{t.monthlyUsd === null ? "/yr" : t.monthlyUsd === 0 ? "" : "/mo"}</span>
              </div>
              <div className="mt-1 text-sm text-muted">{k === "enterprise" ? "3% to $1M · 2% to $5M · 1.5% above" : `${t.feePct}% per deal`}</div>
              <p className="mt-4 text-sm text-foreground/80 flex-1">{FOR[k]}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-muted">
                <li>AI post verification with evidence</li>
                <li>PayPal escrow and automatic payout</li>
                <li>Daily stay-up re-checks</li>
                {k !== "starter" ? <li>Campaign dashboard exports</li> : null}
                {k === "pro" || k === "enterprise" ? <li>Team seats and API</li> : null}
                {k === "enterprise" ? <li>#ad compliance audit reports</li> : null}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3 text-sm text-muted">
        <p>$5 minimum fee per deal. Starter fee is capped at $250 per deal.</p>
        <p>On a failed deal the brand is refunded and our fee is refunded with it. PayPal&apos;s processing fee on a refunded deal is borne by the brand.</p>
        <p>Enterprise pricing is set in spend bands so procurement can budget; annual minimum applies.</p>
      </div>
    </div>
  );
}

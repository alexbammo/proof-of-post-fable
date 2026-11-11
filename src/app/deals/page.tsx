import type { Metadata } from "next";
import Link from "next/link";
import { listDeals } from "@/lib/deals";
import { ensureDemoParties } from "@/lib/parties";
import { StatusChip } from "@/components/StatusChip";
import { usd } from "@/lib/money";
import { shortTitle, platformName } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Deals" };

export default async function DealsPage() {
  await ensureDemoParties();
  const deals = await listDeals();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
          <p className="text-sm text-muted mt-1">Every deal, from first chat to payout.</p>
        </div>
        <Link href="/deals/new" className="btn-primary">
          New deal
        </Link>
      </div>
      {deals.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">No deals yet. Start one and agree the terms in chat.</div>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
          {deals.map((d) => (
            <li key={d.id}>
              <Link href={`/deals/${d.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-background">
                <div className="flex-1 min-w-[12rem]">
                  <div className="font-medium">{shortTitle(d.title, 72)}</div>
                  <div className="text-xs text-muted">
                    {platformName(d.terms.platform)} · @{d.terms.creatorAccount || "—"} · {new Date(d.createdAt).toLocaleDateString("en-GB")}
                  </div>
                </div>
                <StatusChip status={d.status} />
                <div className="text-sm tabular-nums w-24 text-right">{usd(d.priceCents)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

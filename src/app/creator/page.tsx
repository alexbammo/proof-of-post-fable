import type { Metadata } from "next";
import { ensureDemoParties, getCreator, DEMO_CREATOR_ID } from "@/lib/parties";
import { listDeals } from "@/lib/deals";
import { StatusChip } from "@/components/StatusChip";
import { LinkPayPal } from "@/components/LinkPayPal";
import { usd } from "@/lib/money";
import { shortTitle } from "@/lib/text";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Creator" };

export default async function CreatorPage({ searchParams }: PageProps<"/creator">) {
  await ensureDemoParties();
  const sp = await searchParams;
  const creator = (await getCreator(DEMO_CREATOR_ID))!;
  const deals = (await listDeals()).filter((d) => d.creatorId === creator.id);
  const earned = deals.reduce((s, d) => s + d.releasedCents, 0);
  const pending = deals.filter((d) => ["funded", "awaiting_post", "live_checking", "partially_released", "fix_window"].includes(d.status)).reduce((s, d) => s + (d.priceCents - d.releasedCents), 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Creator</h1>
      <p className="text-sm text-muted mt-1">
        {creator.name} · @{creator.handle}
      </p>
      {sp.linked === "1" ? <p className="mt-3 text-sm text-ok">PayPal account linked.</p> : null}

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Stat label="Paid out" value={usd(earned)} />
        <Stat label="Held for you" value={usd(pending)} hint="Released when posts verify" />
        <Stat label="Your fee" value="$0" hint="Creators pay nothing. Brands pay the fee." />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section>
          <h2 className="font-medium">Your deals</h2>
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
            {deals.length === 0 ? <li className="p-5 text-sm text-muted">No deals yet.</li> : null}
            {deals.map((d) => (
              <li key={d.id}>
                <Link href={`/deals/${d.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-background">
                  <div className="flex-1">
                    <div className="font-medium">{shortTitle(d.title, 72)}</div>
                    <div className="text-xs text-muted">
                      {d.terms.platform} · post by {d.terms.postBy || "—"} · stays up {d.terms.stayUpDays}d
                    </div>
                  </div>
                  <StatusChip status={d.status} />
                  <div className="w-24 text-right tabular-nums text-sm">{usd(d.priceCents)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <aside>
          <LinkPayPal creatorId={creator.id} linked={Boolean(creator.paypalMerchantId || creator.paypalEmail)} merchantId={creator.paypalMerchantId} email={creator.paypalEmail} status={creator.onboardingStatus} />
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

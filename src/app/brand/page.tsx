import type { Metadata } from "next";
import { listDeals } from "@/lib/deals";
import { ensureDemoParties, DEMO_BRAND_ID, getBrand } from "@/lib/parties";
import { getDb, schema } from "@/lib/db";
import { desc, inArray } from "drizzle-orm";
import { CampaignGrid, type GridRow } from "@/components/CampaignGrid";
import { usd } from "@/lib/money";
import { shortTitle } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brand dashboard" };

export default async function BrandPage() {
  await ensureDemoParties();
  const brand = (await getBrand(DEMO_BRAND_ID))!;
  const deals = (await listDeals()).filter((d) => d.brandId === brand.id);
  const db = await getDb();
  const ids = deals.map((d) => d.id);
  const checks = ids.length ? await db.select().from(schema.checks).where(inArray(schema.checks.dealId, ids)).orderBy(desc(schema.checks.createdAt)) : [];
  const creators = await db.select().from(schema.creators);
  const cname = new Map(creators.map((c) => [c.id, c.handle ? `@${c.handle}` : c.name]));

  const rows: GridRow[] = deals.map((d) => {
    const latest = checks.find((c) => c.dealId === d.id);
    const funded = !["draft", "agreed"].includes(d.status);
    const held = ["funded", "awaiting_post", "live_checking", "partially_released", "fix_window"].includes(d.status) ? d.priceCents - d.releasedCents : 0;
    return {
      id: d.id,
      title: shortTitle(d.title, 72),
      creator: cname.get(d.creatorId) ?? d.creatorId,
      platform: d.terms.platform,
      status: d.status,
      price: d.priceCents / 100,
      fee: d.platformFeeCents / 100,
      paid: funded ? d.brandTotalCents / 100 : 0,
      held: held / 100,
      released: d.releasedCents / 100,
      refunded: d.refundedCents / 100,
      verdict: latest?.verdict?.verdict ?? null,
      confidence: latest?.verdict?.confidence ?? null,
      disclosure: latest?.verdict?.checks.find((c) => c.term.toLowerCase().includes("disclos"))?.ok ?? null,
      live: latest ? ((latest.snapshot as { isLive?: boolean } | null)?.isLive ?? null) : null,
      postBy: d.terms.postBy,
      stayUpDays: d.terms.stayUpDays,
      lastCheck: latest ? new Date(latest.createdAt).toISOString() : null,
      created: new Date(d.createdAt).toISOString(),
    };
  });

  const totals = rows.reduce(
    (a, r) => ({ paid: a.paid + r.paid, held: a.held + r.held, released: a.released + r.released, refunded: a.refunded + r.refunded }),
    { paid: 0, held: 0, released: 0, refunded: 0 },
  );
  const liveCount = rows.filter((r) => ["live_checking", "partially_released"].includes(r.status)).length;
  const flagged = rows.filter((r) => r.status === "fix_window" || r.verdict === "needs_review").length;

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaign dashboard</h1>
          <p className="text-sm text-muted mt-1">
            {brand.name} · {brand.tier} plan
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 grid-cols-2 md:grid-cols-5">
        <Stat label="Deals" value={String(rows.length)} hint={`${liveCount} live`} />
        <Stat label="Paid in" value={usd(Math.round(totals.paid * 100))} />
        <Stat label="Held by PayPal" value={usd(Math.round(totals.held * 100))} />
        <Stat label="Released" value={usd(Math.round(totals.released * 100))} />
        <Stat label="Flagged" value={String(flagged)} hint="fix window or review" tone={flagged ? "warn" : undefined} />
      </div>
      <div className="mt-6">
        <CampaignGrid rows={rows} />
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" }) {
  return (
    <div className={`rounded-2xl border bg-card p-4 ${tone === "warn" ? "border-warn/40" : "border-border"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${tone === "warn" ? "text-warn" : ""}`}>{value}</div>
      {hint ? <div className="text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

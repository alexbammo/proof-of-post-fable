import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeal, getDealFull } from "@/lib/deals";
import { DealProgress } from "@/components/DealProgress";
import { StatusChip } from "@/components/StatusChip";
import { TermsCard } from "@/components/TermsCard";
import { DealChat } from "@/components/DealChat";
import { DealActions } from "@/components/DealActions";
import { VerdictCard } from "@/components/VerdictCard";
import { usd } from "@/lib/money";
import { shortTitle } from "@/lib/text";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/deals/[id]">): Promise<Metadata> {
  const { id } = await params;
  const deal = await getDeal(id);
  return { title: deal ? shortTitle(deal.title, 48) : "Deal" };
}

export default async function DealPage({ params, searchParams }: PageProps<"/deals/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const full = await getDealFull(id);
  if (!full) notFound();
  const { deal, brand, creator, payments, posts, checks, events } = full;
  const payment = payments[0];
  const post = posts[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/deals" className="text-xs text-muted hover:text-foreground">
            ← All deals
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{shortTitle(deal.title, 72)}</h1>
          <p className="text-sm text-muted mt-1">
            {brand.name} × {creator.name}
            {creator.handle ? ` (@${creator.handle})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusChip status={deal.status} />
        </div>
      </div>

      {sp.paid ? <Banner kind="ok">Payment captured. PayPal is holding {usd(deal.brandTotalCents)} until the post is verified.</Banner> : null}
      {sp.pending ? <Banner kind="warn">PayPal has the payment but the capture is still pending. The deal will move on once PayPal confirms it.</Banner> : null}
      {sp.cancelled ? <Banner kind="warn">PayPal checkout was cancelled. Nothing was charged.</Banner> : null}
      {sp.error ? <Banner kind="bad">Payment step failed ({String(sp.error)}). Check the audit log below.</Banner> : null}

      <div className="mt-6">
        <DealProgress deal={deal} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <DealChat dealId={deal.id} initial={full.messages} locked={deal.status !== "draft"} brandName={brand.name} creatorName={creator.name} />

          {post ? (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-medium">Submitted post</h3>
              <a href={post.url} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-accent break-all">
                {post.url}
              </a>
              <p className="text-xs text-muted mt-1">
                {post.platform} · submitted {new Date(post.submittedAt).toLocaleString("en-GB")} {post.trust === "manual" ? "· lower trust: manual" : ""}
              </p>
            </section>
          ) : null}

          {checks.length ? (
            <section className="space-y-3">
              <h3 className="font-medium">Checks</h3>
              {checks.map((c, i) => (
                <VerdictCard key={c.id} check={c} compact={i > 0} />
              ))}
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-medium">Audit log</h3>
            <ol className="mt-3 space-y-1.5 text-xs">
              {events.map((e) => (
                <li key={e.id} className="grid grid-cols-[9.5rem_1fr] gap-3">
                  <span className="text-muted tabular-nums">{new Date(e.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" })}</span>
                  <span>
                    <span className="font-mono">{e.action}</span> <span className="text-muted">by {e.actor}</span>
                    {e.detail ? <span className="text-muted"> · {summarise(e.detail)}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <TermsCard deal={deal} />
          <DealActions deal={deal} creator={creator} canTimeWarp />
          <section className="rounded-2xl border border-border bg-card p-5 text-sm">
            <h3 className="font-medium">Money</h3>
            <dl className="mt-3 grid grid-cols-2 gap-y-1.5">
              <dt className="text-muted">Brand paid</dt>
              <dd className="text-right">{payment && ["held", "released", "refunded", "captured"].includes(payment.status) ? usd(deal.brandTotalCents) : "—"}</dd>
              <dt className="text-muted">Held by PayPal</dt>
              <dd className="text-right">{payment?.status === "held" ? usd(deal.priceCents - deal.releasedCents) : "—"}</dd>
              <dt className="text-muted">Released to creator</dt>
              <dd className="text-right">{usd(deal.releasedCents)}</dd>
              <dt className="text-muted">Refunded to brand</dt>
              <dd className="text-right">{usd(deal.refundedCents)}</dd>
            </dl>
            {payment?.paypalOrderId ? (
              <p className="mt-3 text-xs text-muted font-mono break-all">
                order {payment.paypalOrderId}
                {payment.paypalCaptureId ? ` · capture ${payment.paypalCaptureId}` : ""}
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Banner({ kind, children }: { kind: "ok" | "warn" | "bad"; children: React.ReactNode }) {
  const cls = { ok: "border-ok/30 bg-ok/10 text-ok", warn: "border-warn/30 bg-warn/10 text-warn", bad: "border-bad/30 bg-bad/10 text-bad" }[kind];
  return <div className={`mt-4 rounded-xl border px-4 py-2.5 text-sm ${cls}`}>{children}</div>;
}

function summarise(detail: unknown): string {
  if (!detail || typeof detail !== "object") return String(detail);
  return Object.entries(detail as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
    .slice(0, 4)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(", ");
}

import type { Metadata } from "next";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { listDeals } from "@/lib/deals";
import { StatusChip } from "@/components/StatusChip";
import { aiConfigured } from "@/lib/ai/client";
import { paypalConfigured } from "@/lib/paypal/client";
import { shortTitle } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const db = await getDb();
  const events = await db.select().from(schema.auditEvents).orderBy(desc(schema.auditEvents.createdAt)).limit(200);
  const deals = await listDeals();
  const review = deals.filter((d) => d.status === "fix_window" || d.status === "disputed");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="text-sm text-muted mt-1">Demo controls, review queue and the full audit log.</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3 text-sm">
        <Card title="Integrations">
          <Row k="PayPal sandbox" v={paypalConfigured() ? "configured" : "missing keys"} ok={paypalConfigured()} />
          <Row k="Claude API" v={aiConfigured() ? "configured" : "missing key"} ok={aiConfigured()} />
          <Row k="Database" v={process.env.DATABASE_URL ? "Postgres" : "embedded (PGlite)"} ok />
        </Card>
        <Card title="Demo clock">
          <p className="text-muted">Each deal page has a “Demo clock” panel that fast-forwards that deal by N days and runs its re-check. It only shifts the deal&apos;s clock offset.</p>
        </Card>
        <Card title="Needs a person">
          {review.length === 0 ? <p className="text-muted">Nothing waiting.</p> : null}
          {review.map((d) => (
            <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center justify-between gap-2 hover:underline">
              <span className="truncate">{shortTitle(d.title, 60)}</span>
              <StatusChip status={d.status} />
            </Link>
          ))}
        </Card>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-medium">Audit log</h2>
        <table className="mt-3 w-full text-xs">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-1 pr-3 font-medium">When</th>
              <th className="py-1 pr-3 font-medium">Deal</th>
              <th className="py-1 pr-3 font-medium">Actor</th>
              <th className="py-1 pr-3 font-medium">Action</th>
              <th className="py-1 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {events.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="py-1.5 pr-3 tabular-nums text-muted whitespace-nowrap">{new Date(e.createdAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" })}</td>
                <td className="py-1.5 pr-3 font-mono">{e.dealId ? <Link href={`/deals/${e.dealId}`} className="hover:underline">{e.dealId.slice(0, 12)}</Link> : "—"}</td>
                <td className="py-1.5 pr-3">{e.actor}</td>
                <td className="py-1.5 pr-3 font-mono">{e.action}</td>
                <td className="py-1.5 text-muted break-all">{e.detail ? JSON.stringify(e.detail).slice(0, 160) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
      <h2 className="font-medium">{title}</h2>
      {children}
    </div>
  );
}
function Row({ k, v, ok }: { k: string; v: string; ok?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{k}</span>
      <span className={ok ? "text-ok" : "text-warn"}>{v}</span>
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Deal, Creator } from "@/lib/db/schema";

async function post(url: string, body?: unknown, headers: Record<string, string> = {}) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
}

export function DealActions({ deal, creator, canTimeWarp }: { deal: Deal; creator: Creator; canTimeWarp: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [postUrl, setPostUrl] = useState("");
  const [manual, setManual] = useState(false);
  const [caption, setCaption] = useState("");
  const [shot, setShot] = useState("");
  const [warpDays, setWarpDays] = useState(7);
  // Admin token for the demo clock. Kept in this browser only; sent only to /api/admin/*.
  const [adminToken, setAdminToken] = useState("");
  useEffect(() => {
    try {
      setAdminToken(window.localStorage.getItem("pop.adminToken") ?? "");
    } catch {}
  }, []);
  function rememberToken(v: string) {
    setAdminToken(v);
    try {
      window.localStorage.setItem("pop.adminToken", v);
    } catch {}
  }

  function run(label: string, fn: () => Promise<unknown>) {
    setErr(null);
    setMsg(null);
    start(async () => {
      try {
        const r = await fn();
        setMsg(typeof r === "string" ? r : label);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const creatorLinked = Boolean(creator.paypalMerchantId || creator.paypalEmail);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-medium">Actions</h3>

      {deal.status === "draft" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">Both sides accept the terms to lock them.</p>
          <div className="flex gap-2 flex-wrap">
            <button disabled={pending || !!deal.brandAcceptedAt} onClick={() => run("Brand accepted", () => post(`/api/deals/${deal.id}/accept`, { side: "brand" }))} className="btn-primary">
              {deal.brandAcceptedAt ? "Brand accepted ✓" : "Accept as brand"}
            </button>
            <button disabled={pending || !!deal.creatorAcceptedAt} onClick={() => run("Creator accepted", () => post(`/api/deals/${deal.id}/accept`, { side: "creator" }))} className="btn-secondary">
              {deal.creatorAcceptedAt ? "Creator accepted ✓" : "Accept as creator"}
            </button>
          </div>
        </div>
      ) : null}

      {deal.status === "agreed" ? (
        <div className="space-y-2">
          {!creatorLinked ? (
            <p className="text-sm text-warn">
              The creator hasn&apos;t linked a PayPal account yet. <a className="underline" href="/creator">Link it on the creator page</a>.
            </p>
          ) : (
            <p className="text-sm text-muted">PayPal holds the money until the post is verified. The creator is the seller on this payment.</p>
          )}
          <button
            disabled={pending || !creatorLinked}
            onClick={() =>
              run("Redirecting to PayPal…", async () => {
                const r = await post(`/api/deals/${deal.id}/pay`);
                window.location.href = r.approveUrl;
                return "Redirecting to PayPal…";
              })
            }
            className="btn-primary"
          >
            Pay with PayPal (sandbox)
          </button>
        </div>
      ) : null}

      {deal.status === "awaiting_post" || deal.status === "fix_window" ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            run("Post submitted and checked", () => post(`/api/deals/${deal.id}/post`, { url: postUrl, manual: manual ? { captionText: caption, screenshotPath: shot } : undefined }));
          }}
        >
          <p className="text-sm text-muted">{deal.status === "fix_window" ? "Fix the post, then resubmit the link." : "Creator: paste the link to the live post."}</p>
          <input value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="https://bsky.app/profile/…/post/…" className="input" required />
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={manual} onChange={(e) => setManual(e.target.checked)} /> Platform not supported: submit a screenshot instead (lower trust)
          </label>
          {manual ? (
            <>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Paste the post caption text" className="input" rows={3} />
              <input value={shot} onChange={(e) => setShot(e.target.value)} placeholder="Screenshot image URL" className="input" />
            </>
          ) : null}
          <button disabled={pending || !postUrl} className="btn-primary">
            Submit post and run the check
          </button>
        </form>
      ) : null}

      {["live_checking", "partially_released", "fix_window"].includes(deal.status) ? (
        <div className="space-y-2">
          <button disabled={pending} onClick={() => run("Re-check complete", () => post(`/api/deals/${deal.id}/recheck`))} className="btn-secondary">
            Run re-check now
          </button>
        </div>
      ) : null}

      {canTimeWarp && !["draft", "agreed", "released", "refunded", "closed"].includes(deal.status) ? (
        <div className="rounded-xl border border-dashed border-warn/50 bg-warn/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-warn">Demo clock</span>
            <span className="text-xs text-muted">offset +{deal.clockOffsetDays}d</span>
          </div>
          <p className="text-xs text-muted">Fast-forwards this deal by N days and runs the scheduled re-check immediately. Demo control only.</p>
          <input type="password" value={adminToken} onChange={(e) => rememberToken(e.target.value)} placeholder="Admin token" className="input" autoComplete="off" />
          <div className="flex gap-2 items-center">
            <input type="number" min={1} max={60} value={warpDays} onChange={(e) => setWarpDays(Number(e.target.value))} className="input w-20" />
            <button
              disabled={pending || !adminToken}
              onClick={() => run(`Jumped ${warpDays} days`, () => post(`/api/admin/clock`, { dealId: deal.id, days: warpDays }, { "x-admin-token": adminToken }))}
              className="btn-warn"
            >
              Jump {warpDays} day{warpDays === 1 ? "" : "s"} →
            </button>
          </div>
        </div>
      ) : null}

      {pending ? <p className="text-xs text-muted">Working…</p> : null}
      {msg ? <p className="text-xs text-ok">{msg}</p> : null}
      {err ? <p className="text-xs text-bad">{err}</p> : null}
    </div>
  );
}

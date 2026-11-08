"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function LinkPayPal({ creatorId, linked, merchantId, email, status }: { creatorId: string; linked: boolean; merchantId: string | null; email: string | null; status: string }) {
  const [quickEmail, setQuickEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function call(body?: unknown, after?: (j: { actionUrl?: string }) => void) {
    setErr(null);
    start(async () => {
      const r = await fetch(`/api/creators/${creatorId}/onboard`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const j = await r.json();
      if (!r.ok) {
        setErr(j.error ?? "Failed");
        return;
      }
      after?.(j);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-medium">PayPal account</h3>
      {linked ? (
        <div className="text-sm">
          <p className="text-ok">Linked</p>
          <p className="text-xs text-muted font-mono break-all mt-1">{merchantId ? `merchant ${merchantId}` : email}</p>
          <p className="text-xs text-muted mt-2">Payments for your deals go to this account. You are the seller; PayPal holds the money until the post is verified.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">Connect the PayPal account that should receive your payouts. Status: {status.replace("_", " ")}.</p>
          <button disabled={pending} className="btn-primary w-full" onClick={() => call({}, (j) => j.actionUrl && (window.location.href = j.actionUrl))}>
            Connect with PayPal
          </button>
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">Sandbox shortcut: link by sandbox email</summary>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                call({ paypalEmail: quickEmail });
              }}
            >
              <input value={quickEmail} onChange={(e) => setQuickEmail(e.target.value)} placeholder="sb-xxxx@business.example.com" className="input" />
              <button disabled={pending || !quickEmail} className="btn-secondary">
                Link
              </button>
            </form>
          </details>
        </>
      )}
      {err ? <p className="text-xs text-bad">{err}</p> : null}
    </div>
  );
}

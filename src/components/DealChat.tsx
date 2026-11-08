"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Msg = { id: string; role: string; content: string };

export function DealChat({ dealId, initial, locked, brandName, creatorName }: { dealId: string; initial: Msg[]; locked: boolean; brandName: string; creatorName: string }) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [role, setRole] = useState<"brand" | "creator">("brand");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function send() {
    const content = text.trim();
    if (!content) return;
    setText("");
    setError(null);
    const optimistic = { id: `tmp-${Date.now()}`, role, content };
    setMessages((m) => [...m, optimistic]);
    start(async () => {
      const r = await fetch(`/api/deals/${dealId}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role, content }) });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error ?? "Something went wrong");
        return;
      }
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: j.reply }]);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card flex flex-col min-h-[28rem]">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-medium">Deal chat</h3>
        <span className="text-xs text-muted">AI turns the conversation into terms</span>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted">
            Start by describing the deal in plain English, e.g. “One Bluesky post from @maya.films about our new oat-milk chai, must include #ad and #NimbusTea, up by Friday, stays up 7 days, $250.”
          </p>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "assistant" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "assistant" ? "bg-background border border-border" : m.role === "brand" ? "bg-accent text-accent-ink" : "bg-hold text-white"}`}>
              <div className={`text-[10px] uppercase tracking-wide mb-0.5 ${m.role === "assistant" ? "text-muted" : "opacity-75"}`}>
                {m.role === "assistant" ? "Deal builder" : m.role === "brand" ? brandName : creatorName}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          </div>
        ))}
        {pending ? <div className="text-xs text-muted">Deal builder is thinking…</div> : null}
        {error ? <div className="text-xs text-bad">{error}</div> : null}
      </div>
      {locked ? (
        <div className="px-5 py-3 border-t border-border text-xs text-muted">Terms are locked. Both sides accepted.</div>
      ) : (
        <form
          className="p-3 border-t border-border flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div className="flex rounded-lg border border-border overflow-hidden text-xs shrink-0 self-start sm:self-auto">
            {(["brand", "creator"] as const).map((r) => (
              <button type="button" key={r} onClick={() => setRole(r)} className={`px-3 py-2 ${role === r ? "bg-foreground text-background" : "bg-card hover:bg-background"}`}>
                {r === "brand" ? brandName : creatorName}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder={`Message as ${role === "brand" ? brandName : creatorName}…`}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
          />
          <button type="submit" disabled={pending || !text.trim()} className="rounded-lg bg-accent text-accent-ink px-4 py-2 text-sm font-medium disabled:opacity-50">
            Send
          </button>
        </form>
      )}
    </div>
  );
}

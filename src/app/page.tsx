import Link from "next/link";

const steps = [
  { n: "1", title: "Agree in plain English", body: "Brand and creator chat. The AI turns it into fixed terms both sides tap to accept." },
  { n: "2", title: "Brand pays, PayPal holds", body: "PayPal checkout with the creator as the seller. Funds are held, our fee splits off automatically." },
  { n: "3", title: "AI checks the post", body: "Live, matches the brief, carries the #ad label, and stays up for the agreed days. Reasons in plain English." },
  { n: "4", title: "Money releases itself", body: "Pass: PayPal pays the creator, at go-live or after the stay-up period. Fail: a fix window, then the brand is refunded." },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-accent">Brand deals, proven</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            Pay creators the moment the post is proven.
          </h1>
          <p className="mt-5 text-lg text-muted max-w-prose">
            Proof of Post holds the brand&apos;s money with PayPal, checks the post with AI, and releases payment automatically.
            Half the cost of a manager. You only pay when the post is proven.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {/* No prefetch: this route creates a draft deal, so it must only run on a real click. */}
            <Link href="/deals/new" prefetch={false} className="rounded-lg bg-accent text-accent-ink px-5 py-2.5 text-sm font-medium hover:opacity-90">
              Start a deal
            </Link>
            <Link href="/brand" className="rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-background">
              See the brand dashboard
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted">Example deal</p>
          <dl className="mt-3 grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted">Creator receives</dt>
            <dd className="text-right font-medium">$250.00</dd>
            <dt className="text-muted">Platform fee (8%)</dt>
            <dd className="text-right">$20.00</dd>
            <dt className="text-muted">PayPal processing (est.)</dt>
            <dd className="text-right">$10.27</dd>
            <dt className="border-t border-border pt-3 font-medium">Brand pays</dt>
            <dd className="border-t border-border pt-3 text-right font-semibold">$280.27</dd>
          </dl>
          <p className="mt-4 text-xs text-muted">The creator always gets exactly the agreed amount. Creators pay nothing.</p>
        </div>
      </section>

      <section className="pb-14 grid gap-4 md:grid-cols-3">
        {[
          ["Money held by PayPal, never by us", "A PayPal multiparty order with the creator as the seller and delayed disbursement. We can only release or refund."],
          ["Every verdict quotes its evidence", "Claude reads the live post and returns pass or fail per term, with the exact text, flag or timestamp it relied on."],
          ["Creators keep 100%", "The brand pays the fee on top. The creator receives exactly the agreed amount, automatically."],
        ].map(([h, b]) => (
          <div key={h} className="rounded-xl border border-border bg-card/60 p-5">
            <h3 className="font-medium">{h}</h3>
            <p className="mt-1.5 text-sm text-muted">{b}</p>
          </div>
        ))}
      </section>

      <section className="pb-24">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-4">
          {steps.map((s) => (
            <li key={s.n} className="rounded-xl border border-border bg-card p-5">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent/10 text-accent text-sm font-semibold">{s.n}</span>
              <h3 className="mt-3 font-medium">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

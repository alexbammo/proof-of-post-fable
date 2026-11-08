import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Proof of Post", template: "%s · Proof of Post" },
  description: "Brand deals that pay the creator automatically once AI has verified the post. Money held by PayPal.",
};

const nav = [
  { href: "/deals", label: "Deals" },
  { href: "/brand", label: "Brand" },
  { href: "/creator", label: "Creator" },
  { href: "/pricing", label: "Pricing" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
            <Link href="/" className="font-semibold tracking-tight flex items-center gap-2">
              <span className="inline-block size-5 rounded-md bg-accent" aria-hidden />
              Proof of Post
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="px-3 py-1.5 rounded-md hover:bg-background text-foreground/80 hover:text-foreground">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border text-xs text-muted">
          <div className="mx-auto max-w-6xl px-4 py-6 flex flex-wrap gap-x-6 gap-y-2 justify-between">
            <span>Proof of Post · sandbox demo, no real money moves</span>
            <span>Creators pay nothing and keep 100%.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}

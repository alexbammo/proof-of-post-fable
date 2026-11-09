"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/deals", label: "Deals" },
  { href: "/brand", label: "Brand" },
  { href: "/creator", label: "Creator" },
  { href: "/pricing", label: "Pricing" },
];

export function NavLinks() {
  const path = usePathname() ?? "";
  return (
    <nav className="flex items-center gap-1 text-sm">
      {NAV.map((n) => {
        const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`px-3 py-1.5 rounded-md hover:bg-background ${active ? "bg-background text-foreground font-medium" : "text-foreground/70 hover:text-foreground"}`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

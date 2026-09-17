"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Globe, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Results", href: "/public" },
  { label: "Statistics", href: "/public#turnout" },
  { label: "Reports", href: "/public#downloads" },
  { label: "About", href: "/public#about" },
];

export function PublicHeader() {
  const pathname = usePathname();

  return (
    <header className="flex h-[60px] items-center justify-between border-b border-pub-border bg-pub-card px-6">
      <Link href="/public" className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-pub-blue" />
        <div className="leading-tight">
          <p className="text-sm font-semibold text-pub-text">ElectIQ</p>
          <p className="text-[10px] text-pub-text-secondary">Transparent Elections. A Stronger Tomorrow.</p>
        </div>
      </Link>

      <nav className="hidden items-center gap-6 md:flex">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/public" && pathname === "/public";
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "border-b-2 pb-1 pt-1 text-sm transition-colors",
                isActive
                  ? "border-pub-blue text-pub-blue font-medium"
                  : "border-transparent text-pub-text-secondary hover:text-pub-text"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        aria-label="Select language"
        className="flex items-center gap-1.5 rounded-md border border-pub-border px-2.5 py-1.5 text-sm text-pub-text-secondary"
      >
        <Globe className="h-4 w-4" />
        EN
        <ChevronDown className="h-3 w-3" />
      </button>
    </header>
  );
}

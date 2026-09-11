import Link from "next/link";
import { ShieldCheck } from "lucide-react";

const NAV = [
  { label: "Results", href: "/public" },
  { label: "Candidates", href: "/public/candidates" },
  { label: "Regions", href: "/public/regions" },
  { label: "Turnout", href: "/public/turnout" },
  { label: "Map", href: "/public/map" },
  { label: "Updates", href: "/public/updates" },
  { label: "Election Data", href: "/public/election" },
];

/**
 * This layout deliberately does not call requireSession() or render the
 * Command Center sidebar/topbar — Section 10 calls for "independent
 * public experience," and every page under src/app/public/ is reachable
 * without logging in. Every data read on these pages goes through
 * src/lib/public/queries.ts, which hard-codes PUBLISHED-only filtering
 * (Section 31) — this layout has no authorization logic of its own
 * because the pages beneath it should never need any.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy-primary">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/public" className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <span className="text-sm font-semibold text-light">ElectIQ Public Portal</span>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-xs text-neutral hover:bg-white/5 hover:text-light"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-6 py-8 text-xs text-neutral">
        Only officially published results are shown here. Figures update as more polling stations are
        published — see the Updates page for the latest publication activity.
      </footer>
    </div>
  );
}

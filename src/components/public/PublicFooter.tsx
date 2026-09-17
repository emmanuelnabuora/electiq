import Link from "next/link";
import { ShieldCheck } from "lucide-react";

/**
 * Institutional branding, kept as named constants rather than inline
 * text -- per the approved design's explicit requirement that this
 * stay configurable so a deployment never falsely represents itself as
 * an official IEBC system without authorization. Change these two
 * lines to update the disclosure everywhere it appears in the footer.
 */
const INSTITUTIONAL_NAME = "Independent Electoral and Boundaries Commission (IEBC)";
const COUNTRY_NAME = "Republic of Kenya";

const FOOTER_LINKS = ["Results", "Statistics", "Reports", "About", "Privacy", "Terms", "Contact"];

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer id="about" className="border-t border-pub-border bg-pub-card">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-8 px-6 py-10 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-pub-blue" />
            <p className="font-semibold text-pub-text">ElectIQ</p>
          </div>
          <p className="mt-1 text-sm text-pub-text-secondary">{COUNTRY_NAME}</p>
          <p className="mt-3 text-xs text-pub-text-secondary">{INSTITUTIONAL_NAME}</p>
        </div>

        <nav className="flex flex-wrap gap-x-5 gap-y-2 md:justify-center">
          {FOOTER_LINKS.map((label) => (
            <Link key={label} href="#" className="text-sm text-pub-text-secondary hover:text-pub-text">
              {label}
            </Link>
          ))}
        </nav>

        <div className="md:text-right">
          <p className="text-sm font-medium text-pub-text">A Stronger Kenya</p>
          <p className="text-sm text-pub-text-secondary">Through Transparent Elections</p>
        </div>
      </div>
      <div className="border-t border-pub-border px-6 py-4 text-center text-xs text-pub-text-secondary">
        © {year} {COUNTRY_NAME}. Data last updated: <span suppressHydrationWarning>{new Date().toLocaleString("en-US")}</span>
      </div>
    </footer>
  );
}

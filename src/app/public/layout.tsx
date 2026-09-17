import { PublicHeader } from "@/components/public/PublicHeader";
import { PublicFooter } from "@/components/public/PublicFooter";
import { DemoDataBanner } from "@/components/public/DemoDataBanner";

/**
 * This layout deliberately does not call requireSession() or render the
 * internal Command Center sidebar/topbar -- every page under
 * src/app/public/ must remain reachable without logging in. Every data
 * read on these pages goes through src/lib/public/queries.ts, which
 * hard-codes PUBLISHED-only filtering (Section 31) -- this layout has
 * no authorization logic of its own because the pages beneath it
 * should never need any.
 *
 * Replaces the previous dark-theme shell with the approved Republic of
 * Kenya public design (Screen 8) -- same underlying pages/data, new
 * visual presentation. Sub-pages under src/app/public/ not yet
 * restyled to this new light theme (candidates, regions, turnout, map,
 * updates, election) remain reachable at their existing URLs but are
 * not linked from the new nav, which points at this consolidated page
 * instead; restyling those is a follow-up, not silently dropped.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-pub-bg">
      <PublicHeader />
      <DemoDataBanner />
      <main className="mx-auto max-w-[1600px]">{children}</main>
      <PublicFooter />
    </div>
  );
}

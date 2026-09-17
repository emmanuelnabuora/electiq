import Link from "next/link";
import type { PublicRegionResult } from "@/lib/public/queries";

/**
 * The compact county table half of the approved design's "Results by
 * County" panel. The map half (KenyaResultsMap) is deliberately not
 * built here -- it's Phase 4's own scope, since it needs a real,
 * verified Kenya county boundary dataset that hasn't been sourced yet,
 * and the plan is explicit that fabricating geometry isn't acceptable.
 */
export function CountyResultsTable({ regions }: { regions: PublicRegionResult[] }) {
  const sorted = [...regions].sort((a, b) => b.turnoutPct - a.turnoutPct);

  return (
    <div className="rounded-xl border border-pub-border bg-pub-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-pub-text">Results by County</h2>
        <Link href="#" className="text-xs font-medium text-pub-blue">
          Explore by county →
        </Link>
      </div>

      <p className="mb-3 text-xs text-pub-text-secondary">
        The interactive county map is not available in this preview -- see the follow-up plan for
        adding verified county boundary data.
      </p>

      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-pub-text-secondary">
              <th className="border-b border-pub-border py-2 font-medium">County</th>
              <th className="border-b border-pub-border py-2 font-medium">Turnout</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.unitName}>
                <td className="border-b border-pub-border py-2 text-pub-text">{r.unitName}</td>
                <td className="border-b border-pub-border py-2 text-pub-text">{r.turnoutPct.toFixed(1)}%</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={2} className="py-6 text-center text-pub-text-secondary">
                  No published results yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Link href="#" className="mt-3 block text-center text-xs font-medium text-pub-blue">
        View all counties →
      </Link>
    </div>
  );
}

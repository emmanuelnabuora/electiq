import Link from "next/link";
import type { PublicRegionResult, PublicRegionGeo } from "@/lib/public/queries";
import { KenyaResultsMap } from "@/components/public/KenyaResultsMapLoader";

/**
 * The compact county table half of the approved design's "Results by
 * County" panel, plus the map itself (KenyaResultsMap) -- which renders
 * real polygons when boundary data exists and an honest "not available"
 * state when it doesn't, rather than two separately-maintained
 * placeholder and real versions.
 */
export function CountyResultsTable({
  regions,
  geoRegions,
}: {
  regions: PublicRegionResult[];
  geoRegions: PublicRegionGeo[];
}) {
  const sorted = [...regions].sort((a, b) => b.turnoutPct - a.turnoutPct);

  return (
    <div className="rounded-xl border border-pub-border bg-pub-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-pub-text">Results by County</h2>
        <Link href="#" className="text-xs font-medium text-pub-blue">
          Explore by county →
        </Link>
      </div>

      <div className="mb-4">
        <KenyaResultsMap regions={geoRegions} />
      </div>

      <div className="max-h-64 overflow-y-auto">
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

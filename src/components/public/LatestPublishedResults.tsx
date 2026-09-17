import Link from "next/link";
import type { PublicUpdate } from "@/lib/public/queries";

export function LatestPublishedResults({ updates }: { updates: PublicUpdate[] }) {
  return (
    <div className="rounded-xl border border-pub-border bg-pub-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-pub-text">Latest Published Results</h2>
        <Link href="#" className="text-xs font-medium text-pub-blue">
          View all results →
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-pub-text-secondary">
              <th className="border-b border-pub-border py-2 pr-3 font-medium">Constituency</th>
              <th className="border-b border-pub-border py-2 pr-3 font-medium">County</th>
              <th className="border-b border-pub-border py-2 pr-3 font-medium">Turnout</th>
              <th className="border-b border-pub-border py-2 pr-3 font-medium">Status</th>
              <th className="border-b border-pub-border py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {updates.map((u, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap border-b border-pub-border py-2 pr-3 text-pub-text">
                  {u.constituencyName ?? u.unitName}
                </td>
                <td className="whitespace-nowrap border-b border-pub-border py-2 pr-3 text-pub-text-secondary">
                  {u.countyName ?? "—"}
                </td>
                <td className="whitespace-nowrap border-b border-pub-border py-2 pr-3 text-pub-text">
                  {u.turnoutPct.toFixed(1)}%
                </td>
                <td className="whitespace-nowrap border-b border-pub-border py-2 pr-3">
                  <span className="rounded-full bg-pub-success/10 px-2 py-0.5 text-xs font-medium text-pub-success">
                    PUBLISHED
                  </span>
                </td>
                <td className="whitespace-nowrap border-b border-pub-border py-2 text-pub-text-secondary">
                  {new Date(u.publishedAt).toLocaleString("en-US")}
                </td>
              </tr>
            ))}
            {updates.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-pub-text-secondary">
                  No published results yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

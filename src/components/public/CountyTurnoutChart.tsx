"use client";

import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { PublicRegionResult } from "@/lib/public/queries";

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PublicRegionResult }> }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="rounded-md border border-pub-border bg-white p-2.5 text-xs shadow-lg">
      <p className="font-medium text-pub-text">{r.unitName}</p>
      <p className="text-pub-text-secondary">Registered voters: {r.registeredVoters.toLocaleString("en-US")}</p>
      <p className="text-pub-text-secondary">Votes cast: {r.votesCast.toLocaleString("en-US")}</p>
      <p className="text-pub-text-secondary">Turnout: {r.turnoutPct.toFixed(1)}%</p>
    </div>
  );
}

export function CountyTurnoutChart({ regions }: { regions: PublicRegionResult[] }) {
  const data = [...regions].sort((a, b) => a.unitName.localeCompare(b.unitName));

  return (
    <div className="rounded-xl border border-pub-border bg-pub-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-pub-text">Voter Turnout by County</h2>
        <Link href="#" className="text-xs font-medium text-pub-blue">
          View detailed statistics →
        </Link>
      </div>

      {data.length === 0 ? (
        <p className="py-6 text-center text-sm text-pub-text-secondary">No published data yet.</p>
      ) : (
        <div className="h-64 w-full overflow-x-auto">
          <ResponsiveContainer width="100%" height="100%" minWidth={data.length * 60}>
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
              <XAxis
                dataKey="unitName"
                tick={{ fontSize: 10, fill: "#64748B" }}
                angle={-35}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11, fill: "#64748B" }} unit="%" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="turnoutPct" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

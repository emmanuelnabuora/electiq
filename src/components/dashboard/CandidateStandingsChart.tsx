"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { CandidateStanding } from "@/lib/results/candidate-standings";

/**
 * Same chart logic as the original Command Center dashboard's
 * LiveResultsPanel candidate-standings chart, restyled for the light
 * theme (axis/tooltip colors only -- the data and chart type are
 * unchanged).
 */
export function CandidateStandingsChart({ standings }: { standings: CandidateStanding[] }) {
  if (standings.every((s) => s.votes === 0)) {
    return <p className="text-sm text-eiq-text-secondary">No votes reported yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, standings.length * 40)}>
      <BarChart data={standings} layout="vertical" margin={{ left: 24 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="fullName" width={140} tick={{ fill: "#102033", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value, _name, item) => [
            `${Number(value).toLocaleString("en-US")} votes (${(item?.payload?.sharePct ?? 0).toFixed(1)}%)`,
            item?.payload?.partyAbbreviation ?? "",
          ]}
          contentStyle={{ background: "#FFFFFF", border: "1px solid #E5EAF0" }}
          labelStyle={{ color: "#102033" }}
        />
        <Bar dataKey="votes" fill="#2563EB" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

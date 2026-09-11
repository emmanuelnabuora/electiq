"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { DistributionStats } from "@/lib/analytics/distributions";

export function DistributionBars({ stats, unit }: { stats: DistributionStats; unit: string }) {
  if (stats.count === 0) {
    return <p className="text-sm text-neutral">No reporting stations to summarize yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <p className="text-neutral">Min</p>
          <p className="text-light">{stats.min.toFixed(1)}{unit}</p>
        </div>
        <div>
          <p className="text-neutral">Median</p>
          <p className="text-light">{stats.median.toFixed(1)}{unit}</p>
        </div>
        <div>
          <p className="text-neutral">Mean</p>
          <p className="text-light">{stats.mean.toFixed(1)}{unit}</p>
        </div>
        <div>
          <p className="text-neutral">Max</p>
          <p className="text-light">{stats.max.toFixed(1)}{unit}</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={stats.buckets}>
          <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            formatter={(value) => [`${value} stations`, "Count"]}
            contentStyle={{ background: "#111F30", border: "1px solid rgba(255,255,255,0.1)" }}
            labelStyle={{ color: "#F7F9FC" }}
          />
          <Bar dataKey="count" fill="#2F80ED" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-neutral">Based on {stats.count} reporting station(s).</p>
    </div>
  );
}

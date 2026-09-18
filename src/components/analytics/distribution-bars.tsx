"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { DistributionStats } from "@/lib/analytics/distributions";

export function DistributionBars({ stats, unit }: { stats: DistributionStats; unit: string }) {
  if (stats.count === 0) {
    return <p className="text-sm text-eiq-text-secondary">No reporting stations to summarize yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <p className="text-eiq-text-secondary">Min</p>
          <p className="text-eiq-text-primary">{stats.min.toFixed(1)}{unit}</p>
        </div>
        <div>
          <p className="text-eiq-text-secondary">Median</p>
          <p className="text-eiq-text-primary">{stats.median.toFixed(1)}{unit}</p>
        </div>
        <div>
          <p className="text-eiq-text-secondary">Mean</p>
          <p className="text-eiq-text-primary">{stats.mean.toFixed(1)}{unit}</p>
        </div>
        <div>
          <p className="text-eiq-text-secondary">Max</p>
          <p className="text-eiq-text-primary">{stats.max.toFixed(1)}{unit}</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={stats.buckets}>
          <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            formatter={(value) => [`${value} stations`, "Count"]}
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E5EAF0" }}
            labelStyle={{ color: "#102033" }}
          />
          <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-eiq-text-secondary">Based on {stats.count} reporting station(s).</p>
    </div>
  );
}

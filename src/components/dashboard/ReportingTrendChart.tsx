"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { ReportingTrendPoint } from "@/lib/results/reporting-trend";

/**
 * Same chart logic as the original Command Center dashboard's
 * LiveResultsPanel reporting-trend chart, restyled for the light theme.
 */
export function ReportingTrendChart({ trend }: { trend: ReportingTrendPoint[] }) {
  if (trend.length < 2) {
    return <p className="text-sm text-eiq-text-secondary">Not enough submissions yet to chart a trend.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={trend}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" />
        <XAxis
          dataKey="time"
          tickFormatter={(t) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          tick={{ fill: "#64748B", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip
          labelFormatter={(t) => new Date(String(t)).toLocaleString("en-US")}
          formatter={(value) => Number(value).toLocaleString("en-US")}
          contentStyle={{ background: "#FFFFFF", border: "1px solid #E5EAF0" }}
          labelStyle={{ color: "#102033" }}
        />
        <Line type="monotone" dataKey="cumulativeStations" name="Stations reporting" stroke="#22C55E" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

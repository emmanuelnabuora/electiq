"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { ReportingTrendPoint } from "@/lib/results/reporting-trend";

/**
 * Real turnout-over-time, not a simulated curve: each point is an
 * actual result-submission event (from getReportingTrend's real
 * submittedAt timestamps), with turnoutPct computed by dividing that
 * moment's real cumulative votes cast by the total registered voters
 * across the reporting scope -- a constant, not something that
 * changes per point, so early points understate true turnout exactly
 * the way "only 40% of stations have reported" should.
 */
export function TurnoutTrendChart({
  trend,
  totalRegisteredVoters,
}: {
  trend: ReportingTrendPoint[];
  totalRegisteredVoters: number;
}) {
  if (trend.length < 2 || totalRegisteredVoters === 0) {
    return <p className="text-sm text-eiq-text-secondary">Not enough submissions yet to chart a trend.</p>;
  }

  const data = trend.map((t) => ({
    time: t.time,
    turnoutPct: (t.cumulativeVotesCast / totalRegisteredVoters) * 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" />
        <XAxis
          dataKey="time"
          tickFormatter={(t) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          tick={{ fill: "#64748B", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip
          labelFormatter={(t) => new Date(String(t)).toLocaleString("en-US")}
          formatter={(value) => `${Number(value).toFixed(1)}%`}
          contentStyle={{ background: "#FFFFFF", border: "1px solid #E5EAF0" }}
          labelStyle={{ color: "#102033" }}
        />
        <Line type="monotone" dataKey="turnoutPct" name="Turnout" stroke="#2563EB" dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

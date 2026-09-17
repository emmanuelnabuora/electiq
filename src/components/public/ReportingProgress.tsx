"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

type Props = {
  reportingPollingStations: number;
  pendingPollingStations: number;
  notReportingPollingStations: number;
  reportingPct: number;
};

export function ReportingProgress({
  reportingPollingStations,
  pendingPollingStations,
  notReportingPollingStations,
  reportingPct,
}: Props) {
  const data = [
    { name: "Reporting", value: reportingPollingStations, color: "#2563EB" },
    { name: "Pending", value: pendingPollingStations, color: "#F59E0B" },
    { name: "Not reporting", value: notReportingPollingStations, color: "#E4EAF2" },
  ];

  return (
    <div className="rounded-xl border border-pub-border bg-pub-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-pub-text">Reporting Progress</h2>
        <span className="flex items-center gap-1 text-xs text-pub-success">
          <span className="h-1.5 w-1.5 rounded-full bg-pub-success" />
          Live updates
        </span>
      </div>

      <div className="relative mx-auto h-48 w-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={60} outerRadius={80} startAngle={90} endAngle={-270}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} stroke="none" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-pub-text">{reportingPct.toFixed(0)}%</p>
          <p className="text-xs text-pub-text-secondary">Reporting</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-pub-text-secondary">
            <span className="h-2 w-2 rounded-full bg-pub-blue" /> Reporting stations
          </span>
          <span className="font-medium text-pub-text">{reportingPollingStations.toLocaleString("en-US")}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-pub-text-secondary">
            <span className="h-2 w-2 rounded-full bg-pub-warning" /> Pending stations
          </span>
          <span className="font-medium text-pub-text">{pendingPollingStations.toLocaleString("en-US")}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-pub-text-secondary">
            <span className="h-2 w-2 rounded-full bg-pub-border" /> Not reporting
          </span>
          <span className="font-medium text-pub-text">{notReportingPollingStations.toLocaleString("en-US")}</span>
        </div>
      </div>
    </div>
  );
}

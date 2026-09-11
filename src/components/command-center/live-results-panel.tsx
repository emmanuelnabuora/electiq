"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Standing = { candidateId: string; fullName: string; partyAbbreviation: string | null; votes: number; sharePct: number };
type GeoRow = { unitId: string; unitName: string; totalStations: number; reportingStations: number; reportingPct: number; votesCast: number; turnoutPct: number };
type TrendPoint = { time: string; cumulativeStations: number; cumulativeVotesCast: number };

type Snapshot = {
  generatedAt: string;
  positionName: string;
  aggregate: { reportingStations: number; totalStations: number; votesCast: number };
  standings: Standing[];
  regional: GeoRow[];
  constituencies: GeoRow[];
  trend: TrendPoint[];
};

const REFRESH_INTERVAL_MS = 20_000;

export function LiveResultsPanel({ electionId }: { electionId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSnapshot = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/command-center?electionId=${electionId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Command Center API returned ${res.status}`);
      setSnapshot(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not refresh live results.");
    } finally {
      setRefreshing(false);
    }
  }, [electionId]);

  useEffect(() => {
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchSnapshot]);

  if (error && !snapshot) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-critical">{error}</CardContent>
      </Card>
    );
  }

  if (!snapshot) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">Loading live results…</CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between text-xs text-neutral">
        <span>
          Live figures — {snapshot.aggregate.reportingStations} / {snapshot.aggregate.totalStations}{" "}
          stations reporting for {snapshot.positionName}. Unverified until each result is
          individually approved and published.
        </span>
        <span className="flex items-center gap-1.5">
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          Updated {new Date(snapshot.generatedAt).toLocaleTimeString("en-US")}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Candidate Standings — {snapshot.positionName}</CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            {snapshot.standings.every((s) => s.votes === 0) ? (
              <p className="text-sm text-neutral">No votes reported yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, snapshot.standings.length * 40)}>
                <BarChart data={snapshot.standings} layout="vertical" margin={{ left: 24 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="fullName"
                    width={140}
                    tick={{ fill: "#F7F9FC", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value, _name, item) => [
                      `${Number(value).toLocaleString("en-US")} votes (${(item?.payload?.sharePct ?? 0).toFixed(1)}%)`,
                      item?.payload?.partyAbbreviation ?? "",
                    ]}
                    contentStyle={{ background: "#111F30", border: "1px solid rgba(255,255,255,0.1)" }}
                    labelStyle={{ color: "#F7F9FC" }}
                  />
                  <Bar dataKey="votes" fill="#2F80ED" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reporting Trend</CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            {snapshot.trend.length < 2 ? (
              <p className="text-sm text-neutral">Not enough submissions yet to chart a trend.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={snapshot.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
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
                    contentStyle={{ background: "#111F30", border: "1px solid rgba(255,255,255,0.1)" }}
                    labelStyle={{ color: "#F7F9FC" }}
                  />
                  <Line type="monotone" dataKey="cumulativeStations" name="Stations reporting" stroke="#22C55E" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GeoTable title="Regional Results" rows={snapshot.regional} />
        <GeoTable title="Constituency Results" rows={snapshot.constituencies} />
      </div>
    </div>
  );
}

function GeoTable({ title, rows }: { title: string; rows: GeoRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-neutral">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Reporting</th>
              <th className="py-2 font-medium">Turnout</th>
              <th className="py-2 font-medium">Votes Cast</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.unitId} className="border-t border-white/5">
                <td className="py-2 text-light">{r.unitName}</td>
                <td className="py-2">
                  <Badge tone={r.reportingPct === 100 ? "success" : r.reportingPct > 0 ? "warning" : "neutral"}>
                    {r.reportingStations}/{r.totalStations}
                  </Badge>
                </td>
                <td className="py-2 text-neutral">{r.turnoutPct.toFixed(1)}%</td>
                <td className="py-2 text-neutral">{r.votesCast.toLocaleString("en-US")}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-neutral">
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

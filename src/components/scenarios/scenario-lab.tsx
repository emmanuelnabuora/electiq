"use client";

import { useState } from "react";
import { FlaskConical, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { runScenario } from "@/lib/actions/scenarios";

type Party = { abbreviation: string; name: string };

const SCENARIO_LABELS: Record<string, string> = {
  REMAINING_REPORT: "Remaining Report Simulation",
  TURNOUT_ADJUSTMENT: "Turnout Adjustment",
  SWING_ADJUSTMENT: "Regional Swing Adjustment",
  RUNOFF: "Runoff Simulation",
};

type ScenarioOutput = Awaited<ReturnType<typeof runScenario>>;

export function ScenarioLab({ electionId, positionName, parties }: { electionId: string; positionName: string; parties: Party[] }) {
  const [scenarioType, setScenarioType] = useState<keyof typeof SCENARIO_LABELS>("REMAINING_REPORT");
  const [turnoutDeltaPct, setTurnoutDeltaPct] = useState("5");
  const [targetParty, setTargetParty] = useState(parties[0]?.abbreviation ?? "");
  const [swingDeltaPct, setSwingDeltaPct] = useState("3");
  const [output, setOutput] = useState<ScenarioOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("electionId", electionId);
      formData.set("positionName", positionName);
      formData.set("scenarioType", scenarioType);
      if (scenarioType === "TURNOUT_ADJUSTMENT") formData.set("turnoutDeltaPct", turnoutDeltaPct);
      if (scenarioType === "SWING_ADJUSTMENT") {
        formData.set("targetParty", targetParty);
        formData.set("swingDeltaPct", swingDeltaPct);
      }
      const result = await runScenario(formData);
      setOutput(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run that scenario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 py-4">
          <form onSubmit={handleRun} className="flex flex-col gap-3">
            <select
              value={scenarioType}
              onChange={(e) => setScenarioType(e.target.value as keyof typeof SCENARIO_LABELS)}
              className="w-full rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
            >
              {Object.entries(SCENARIO_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {scenarioType === "TURNOUT_ADJUSTMENT" && (
              <div>
                <Label htmlFor="turnoutDelta">Turnout change (percentage points)</Label>
                <Input
                  id="turnoutDelta"
                  type="number"
                  step="any"
                  value={turnoutDeltaPct}
                  onChange={(e) => setTurnoutDeltaPct(e.target.value)}
                />
              </div>
            )}

            {scenarioType === "SWING_ADJUSTMENT" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="targetParty">Party</Label>
                  <select
                    id="targetParty"
                    value={targetParty}
                    onChange={(e) => setTargetParty(e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
                  >
                    {parties.map((p) => (
                      <option key={p.abbreviation} value={p.abbreviation}>
                        {p.abbreviation} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="swingDelta">Swing (percentage points)</Label>
                  <Input
                    id="swingDelta"
                    type="number"
                    step="any"
                    value={swingDeltaPct}
                    onChange={(e) => setSwingDeltaPct(e.target.value)}
                  />
                </div>
              </div>
            )}

            {error && <p className="text-sm text-critical">{error}</p>}

            <Button type="submit" disabled={loading}>
              <FlaskConical className="h-4 w-4" />
              {loading ? "Running…" : "Run scenario"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {output && <ScenarioOutputView output={output} />}
    </div>
  );
}

function ScenarioOutputView({ output }: { output: ScenarioOutput }) {
  const { result, confidenceNote, modelVersion, executedAt } = output;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4">
        <div className="flex items-center justify-between rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
          <span className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="h-4 w-4" />
            MODEL ESTIMATE — NOT OFFICIAL RESULT
          </span>
          <span className="text-xs text-neutral">
            {modelVersion} · {new Date(executedAt).toLocaleString("en-US")}
          </span>
        </div>

        <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-navy-secondary p-3 text-xs text-light">
          {JSON.stringify(result, null, 2)}
        </pre>

        <div className="rounded-md border border-white/10 p-3 text-xs text-neutral">
          <p className="mb-1 font-medium text-light">Confidence / uncertainty</p>
          {confidenceNote}
        </div>
      </CardContent>
    </Card>
  );
}

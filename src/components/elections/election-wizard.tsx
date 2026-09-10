"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createElection } from "@/lib/actions/elections";

type Country = { id: string; name: string };

const STEPS = ["Basic Info", "Positions", "Review & Create"] as const;

export function ElectionWizard({ countries }: { countries: Country[] }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [electionDate, setElectionDate] = useState("");
  const [countryId, setCountryId] = useState(countries[0]?.id ?? "");
  const [positions, setPositions] = useState<string[]>(["President"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const country = countries.find((c) => c.id === countryId);

  function canAdvance() {
    if (step === 0) return name.trim() !== "" && electionDate !== "" && countryId !== "";
    if (step === 1) return positions.some((p) => p.trim() !== "");
    return true;
  }

  async function handleCreate() {
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("electionDate", electionDate);
      formData.set("countryId", countryId);
      for (const p of positions) {
        if (p.trim()) formData.append("positions", p.trim());
      }
      await createElection(formData);
      // createElection redirects on success; if we reach here, nothing to do.
    } catch (e) {
      // Next.js redirect() throws a special error that must propagate, not be caught as a failure.
      if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
        throw e;
      }
      setError(e instanceof Error ? e.message : "Something went wrong creating the election.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                i <= step ? "bg-accent text-white" : "bg-white/5 text-neutral"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-xs ${i <= step ? "text-light" : "text-neutral"}`}>{label}</span>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-white/10" />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 py-4">
          {step === 0 && (
            <>
              <div>
                <Label htmlFor="name">Election name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Karibu General Election 2026"
                />
              </div>
              <div>
                <Label htmlFor="date">Election date</Label>
                <Input
                  id="date"
                  type="date"
                  value={electionDate}
                  onChange={(e) => setElectionDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <select
                  id="country"
                  value={countryId}
                  onChange={(e) => setCountryId(e.target.value)}
                  className="w-full rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
                >
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-neutral">
                Positions being contested in this election (e.g. President, Member of Parliament).
              </p>
              {positions.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={p}
                    onChange={(e) => {
                      const next = [...positions];
                      next[i] = e.target.value;
                      setPositions(next);
                    }}
                    placeholder="Position name"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPositions(positions.filter((_, idx) => idx !== i))}
                    disabled={positions.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => setPositions([...positions, ""])}>
                <Plus className="h-4 w-4" />
                Add position
              </Button>
            </>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <p className="text-xs text-neutral">Election name</p>
                <p className="text-light">{name}</p>
              </div>
              <div>
                <p className="text-xs text-neutral">Date</p>
                <p className="text-light">{electionDate}</p>
              </div>
              <div>
                <p className="text-xs text-neutral">Country</p>
                <p className="text-light">{country?.name}</p>
              </div>
              <div>
                <p className="text-xs text-neutral">Positions</p>
                <p className="text-light">{positions.filter((p) => p.trim()).join(", ")}</p>
              </div>
              <p className="text-xs text-neutral">
                The election is created in <span className="text-light">DRAFT</span> status. You'll
                add parties and candidates from the election page next.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-critical">{error}</p>}

          <div className="mt-2 flex justify-between">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={handleCreate} disabled={submitting}>
                {submitting ? "Creating…" : "Create Election"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

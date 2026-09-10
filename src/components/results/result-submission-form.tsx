"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { submitResult } from "@/lib/actions/results";
import { validateResultSubmission } from "@/lib/results/validation";

type Candidate = { id: string; fullName: string; partyAbbreviation: string | null };
type Position = { id: string; name: string; candidates: Candidate[] };
type Station = { id: string; name: string; code: string; registeredVoters: number; location: string };

export function ResultSubmissionForm({
  electionId,
  positions,
  stations,
}: {
  electionId: string;
  positions: Position[];
  stations: Station[];
}) {
  const [positionId, setPositionId] = useState(positions[0]?.id ?? "");
  const [stationId, setStationId] = useState("");
  const [registeredVoters, setRegisteredVoters] = useState("");
  const [ballotsIssued, setBallotsIssued] = useState("");
  const [votesCast, setVotesCast] = useState("");
  const [validVotes, setValidVotes] = useState("");
  const [rejectedBallots, setRejectedBallots] = useState("");
  const [candidateVotes, setCandidateVotes] = useState<Record<string, string>>({});
  const [changeReason, setChangeReason] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const position = positions.find((p) => p.id === positionId);
  const station = stations.find((s) => s.id === stationId);

  function selectStation(id: string) {
    setStationId(id);
    const s = stations.find((st) => st.id === id);
    if (s) setRegisteredVoters(String(s.registeredVoters));
  }

  const preview = useMemo(() => {
    if (!position) return null;
    const nums = [registeredVoters, ballotsIssued, votesCast, validVotes, rejectedBallots];
    if (nums.some((n) => n === "")) return null;
    return validateResultSubmission({
      registeredVoters: Number(registeredVoters),
      ballotsIssued: Number(ballotsIssued),
      votesCast: Number(votesCast),
      validVotes: Number(validVotes),
      rejectedBallots: Number(rejectedBallots),
      candidateVotes: position.candidates.map((c) => ({
        candidateId: c.id,
        votes: Number(candidateVotes[c.id] || 0),
      })),
    });
  }, [position, registeredVoters, ballotsIssued, votesCast, validVotes, rejectedBallots, candidateVotes]);

  function captureGps() {
    if (!navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("Could not read device location.")
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    if (!position || !station) {
      e.preventDefault();
      setError("Choose a position and polling station.");
      return;
    }
    setError(null);
    setSubmitting(true);
    // No preventDefault / manual FormData here — this is a real <form
    // action={submitResult}> submission (progressive enhancement), so it
    // works identically whether or not JS has hydrated, and is testable
    // the same way as any other server action in this app.
  }

  return (
    <form action={submitResult} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input type="hidden" name="electionId" value={electionId} />
      {gps && <input type="hidden" name="gpsLatitude" value={gps.lat} />}
      {gps && <input type="hidden" name="gpsLongitude" value={gps.lng} />}
      <Card>
        <CardContent className="flex flex-col gap-4 py-4">
          <div>
            <Label htmlFor="position">Position</Label>
            <select
              id="position"
              name="positionId"
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
            >
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="station">Polling station</Label>
            <select
              id="station"
              name="pollingStationId"
              value={stationId}
              onChange={(e) => selectStation(e.target.value)}
              required
              className="w-full rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
            >
              <option value="">Select a polling station…</option>
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name} ({s.location})
                </option>
              ))}
            </select>
            {stations.length === 0 && (
              <p className="mt-1 text-xs text-critical">
                No polling stations fall within your assigned geography.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="registeredVoters">Registered voters</Label>
              <Input id="registeredVoters" name="registeredVoters" type="number" min={0} value={registeredVoters} onChange={(e) => setRegisteredVoters(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="ballotsIssued">Ballots issued</Label>
              <Input id="ballotsIssued" name="ballotsIssued" type="number" min={0} value={ballotsIssued} onChange={(e) => setBallotsIssued(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="votesCast">Votes cast</Label>
              <Input id="votesCast" name="votesCast" type="number" min={0} value={votesCast} onChange={(e) => setVotesCast(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="validVotes">Valid votes</Label>
              <Input id="validVotes" name="validVotes" type="number" min={0} value={validVotes} onChange={(e) => setValidVotes(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="rejectedBallots">Rejected ballots</Label>
              <Input id="rejectedBallots" name="rejectedBallots" type="number" min={0} value={rejectedBallots} onChange={(e) => setRejectedBallots(e.target.value)} required />
            </div>
          </div>

          {position && (
            <div>
              <p className="mb-2 text-sm font-medium text-light">Candidate votes — {position.name}</p>
              <div className="flex flex-col gap-2">
                {position.candidates.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-neutral">
                      {c.fullName}
                      {c.partyAbbreviation && <span className="ml-1 text-xs">({c.partyAbbreviation})</span>}
                    </span>
                    <input type="hidden" name="candidateId" value={c.id} />
                    <Input
                      type="number"
                      name="candidateVotes"
                      min={0}
                      className="w-32"
                      value={candidateVotes[c.id] ?? ""}
                      onChange={(e) => setCandidateVotes({ ...candidateVotes, [c.id]: e.target.value })}
                      required
                    />
                  </div>
                ))}
                {position.candidates.length === 0 && (
                  <p className="text-sm text-neutral">No candidates registered for this position.</p>
                )}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="changeReason">Reason for correction (only if this replaces a prior submission)</Label>
            <Input id="changeReason" name="changeReason" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="e.g. Recount requested by party agent" />
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={captureGps}>
              <MapPin className="h-4 w-4" />
              {gps ? "Location captured" : "Capture device location"}
            </Button>
            {gps && (
              <span className="text-xs text-neutral">
                {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
              </span>
            )}
          </div>

          {preview && !preview.valid && (
            <div className="rounded-md border border-critical/30 bg-critical/10 p-3 text-sm text-critical">
              <p className="mb-1 font-medium">This will be recorded as requiring correction:</p>
              <ul className="list-inside list-disc">
                {preview.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {preview && preview.valid && (
            <p className="text-sm text-success">Passes all validation rules.</p>
          )}

          {error && <p className="text-sm text-critical">{error}</p>}

          <Button type="submit" disabled={submitting || stations.length === 0}>
            {submitting ? "Submitting…" : "Submit Result"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

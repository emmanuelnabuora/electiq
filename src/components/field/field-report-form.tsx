"use client";

import { useEffect, useState } from "react";
import { MapPin, WifiOff, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { submitFieldReport } from "@/lib/actions/field";
import { enqueueFieldReport, flushQueue, queueLength } from "@/lib/field/offline-queue";

const REPORT_TYPES = ["OPENING", "TURNOUT", "COUNTING", "CLOSING", "GENERAL"] as const;

export function FieldReportForm({
  assignmentId,
  electionId,
}: {
  assignmentId: string;
  electionId: string;
}) {
  const [type, setType] = useState<(typeof REPORT_TYPES)[number]>("OPENING");
  const [notes, setNotes] = useState("");
  const [votersProcessed, setVotersProcessed] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setPending(queueLength());
    const trySync = () => {
      flushQueue(submitFieldReport).then(({ synced, remaining }) => {
        setPending(remaining);
        if (synced > 0) setMessage(`Synced ${synced} queued report(s).`);
      });
    };
    trySync();
    window.addEventListener("online", trySync);
    return () => window.removeEventListener("online", trySync);
  }, []);

  function captureGps() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("Could not read device location.")
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const fields: Record<string, string> = {
      assignmentId,
      electionId,
      type,
      notes,
    };
    if (type === "TURNOUT") fields.votersProcessed = votersProcessed;
    if (gps) {
      fields.latitude = String(gps.lat);
      fields.longitude = String(gps.lng);
    }

    try {
      const formData = new FormData();
      for (const [k, v] of Object.entries(fields)) formData.set(k, v);
      formData.set("clientReportId", crypto.randomUUID());
      await submitFieldReport(formData);
      setMessage("Report submitted.");
      setNotes("");
      setVotersProcessed("");
    } catch (err) {
      // Network failure (offline) vs. a real server rejection both land
      // here from a plain fetch/server-action failure; queue either way —
      // an unnecessary queue+retry is harmless, losing a real report isn't.
      enqueueFieldReport(fields);
      setPending(queueLength());
      setMessage("You appear to be offline — the report was saved on this device and will sync automatically.");
      void err;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        {pending > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            <WifiOff className="h-3.5 w-3.5" />
            {pending} report(s) queued on this device, waiting to sync.
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as (typeof REPORT_TYPES)[number])}
            className="w-full rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
          >
            {REPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()} report
              </option>
            ))}
          </select>

          {type === "TURNOUT" && (
            <div>
              <Label htmlFor="votersProcessed">Voters processed so far</Label>
              <Input
                id="votersProcessed"
                type="number"
                min={0}
                value={votersProcessed}
                onChange={(e) => setVotersProcessed(e.target.value)}
                required
              />
            </div>
          )}

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observations…"
            rows={3}
            className="w-full rounded-md border border-white/10 bg-navy-secondary px-3 py-2 text-sm text-light"
          />

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={captureGps}>
              <MapPin className="h-4 w-4" />
              {gps ? "Location captured" : "Capture location"}
            </Button>
            <Button type="submit" disabled={submitting}>
              <CloudUpload className="h-4 w-4" />
              {submitting ? "Submitting…" : "Submit report"}
            </Button>
          </div>

          {message && <p className="text-sm text-success">{message}</p>}
          {error && <p className="text-sm text-critical">{error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

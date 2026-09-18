"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  previewPollingStationImport,
  confirmPollingStationImport,
  cancelPollingStationImport,
  type ImportPreviewResult,
} from "@/lib/actions/import";

const SAMPLE_CSV = `region_code,constituency_code,ward_code,polling_center_code,polling_center_name,polling_station_code,polling_station_name,registered_voters,latitude,longitude
REG-1,REG1-CON1,REG1-CON1-WRD1,REG1-CON1-WRD1-PC1,Polling Center 1,REG1-CON1-WRD1-PC1-PS3,Polling Station 3,950,-1.22,35.65`;

export function PollingStationImport() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number } | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await previewPollingStationImport(formData);
      setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not process that file.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await confirmPollingStationImport(preview.jobId);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete the import.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!preview) return;
    setLoading(true);
    try {
      await cancelPollingStationImport(preview.jobId);
    } finally {
      setPreview(null);
      setLoading(false);
    }
  }

  if (result) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <p className="text-lg font-medium text-light">Import complete</p>
          <p className="text-sm text-neutral">
            {result.created} polling station{result.created === 1 ? "" : "s"} created.
          </p>
          <Button onClick={() => router.push("/polling-stations")}>
            Back to Polling Stations
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!preview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload a CSV file</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 py-4">
          <p className="text-sm text-neutral">
            Required columns: region_code, constituency_code, ward_code, polling_center_code,
            polling_center_name, polling_station_code, polling_station_name, registered_voters.
            latitude/longitude are optional. Region, constituency, and ward codes must already
            exist — this adds new polling infrastructure to existing geography, it does not create
            new regions/constituencies/wards.
          </p>
          <details className="text-sm text-neutral">
            <summary className="cursor-pointer text-accent">Show a sample row</summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-navy-secondary p-3 text-xs text-light">
              {SAMPLE_CSV}
            </pre>
          </details>
          <form onSubmit={handleUpload} className="flex flex-col gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="text-sm text-light file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-white"
            />
            {error && <p className="text-sm text-critical">{error}</p>}
            <Button type="submit" disabled={loading}>
              <Upload className="h-4 w-4" />
              {loading ? "Validating…" : "Upload and validate"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Preview — {preview.fileName}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 py-4">
          <div className="flex gap-4 text-sm">
            <Badge tone="neutral">{preview.totalRows} total</Badge>
            <Badge tone="success">{preview.validRows} valid</Badge>
            <Badge tone="critical">{preview.errorRows} with errors</Badge>
          </div>

          <div className="max-h-96 overflow-y-auto rounded-md border border-white/5">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-panel">
                <tr className="text-neutral">
                  <th className="px-3 py-2 font-medium">Row</th>
                  <th className="px-3 py-2 font-medium">Station code</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.rowNumber} className="border-t border-white/5">
                    <td className="px-3 py-2 text-neutral">{r.rowNumber}</td>
                    <td className="px-3 py-2 text-light">{r.data.polling_station_code || "—"}</td>
                    <td className="px-3 py-2">
                      {r.errors.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-critical">
                          <XCircle className="h-3.5 w-3.5" /> Error
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-neutral">
                      {r.errors.length > 0 ? r.errors.join("; ") : "Will create new station"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p className="text-sm text-critical">{error}</p>}

          <div className="flex justify-between">
            <Button variant="secondary" onClick={handleCancel} disabled={loading}>
              Cancel import
            </Button>
            <Button onClick={handleConfirm} disabled={loading || preview.validRows === 0}>
              {loading ? "Importing…" : `Confirm and import ${preview.validRows} row(s)`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

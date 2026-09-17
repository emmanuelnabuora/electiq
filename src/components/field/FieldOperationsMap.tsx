"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { fetchFieldOperationsMapData } from "@/lib/actions/gis";
import Link from "next/link";

type MapData = Awaited<ReturnType<typeof fetchFieldOperationsMapData>>;

const KENYA_CENTER: [number, number] = [0.0236, 37.9062];

export function FieldOperationsMap() {
  const [data, setData] = useState<MapData | null>(null);
  const [showStations, setShowStations] = useState(true);
  const [showCheckIns, setShowCheckIns] = useState(true);
  const [showReports, setShowReports] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);

  useEffect(() => {
    fetchFieldOperationsMapData().then(setData);
  }, []);

  if (!data) {
    return <p className="text-sm text-eiq-text-secondary">Loading map data…</p>;
  }

  const hasAnyPoints =
    data.polling.length > 0 || data.checkIns.length > 0 || data.reports.length > 0 || data.incidents.length > 0;

  return (
    <div className="flex h-full gap-4">
      <div className="flex-1 overflow-hidden rounded-lg">
        {!hasAnyPoints ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-eiq-border bg-eiq-bg text-center">
            <p className="max-w-xs text-sm text-eiq-text-secondary">
              No field activity has real coordinates yet for this election's country.
            </p>
          </div>
        ) : (
          <MapContainer center={KENYA_CENTER} zoom={6} scrollWheelZoom={true} className="h-full w-full">
            <TileLayer attribution="" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {showStations &&
              data.polling.map((p) => (
                <CircleMarker key={p.id} center={[p.latitude, p.longitude]} radius={5} pathOptions={{ color: "#9CA3AF", fillColor: "#9CA3AF", fillOpacity: 0.8 }}>
                  <Popup>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs">{p.stationCount} station(s) · {p.registeredVoters.toLocaleString("en-US")} registered voters</p>
                  </Popup>
                </CircleMarker>
              ))}

            {showCheckIns &&
              data.checkIns.map((c) => (
                <CircleMarker key={c.id} center={[c.latitude, c.longitude]} radius={7} pathOptions={{ color: "#22C55E", fillColor: "#22C55E", fillOpacity: 0.85 }}>
                  <Popup>
                    <p className="font-medium">{c.stationName} ({c.stationCode})</p>
                    <p className="text-xs">Observer: {c.observerName}</p>
                    <p className="text-xs">Checked in: {new Date(c.checkedInAt).toLocaleString("en-US")}</p>
                  </Popup>
                </CircleMarker>
              ))}

            {showReports &&
              data.reports.map((r) => (
                <CircleMarker key={r.id} center={[r.latitude, r.longitude]} radius={7} pathOptions={{ color: "#3B82F6", fillColor: "#3B82F6", fillOpacity: 0.85 }}>
                  <Popup>
                    <p className="font-medium">{r.stationName}</p>
                    <p className="text-xs">Report type: {r.type}</p>
                    <p className="text-xs">{new Date(r.submittedAt).toLocaleString("en-US")}</p>
                  </Popup>
                </CircleMarker>
              ))}

            {showIncidents &&
              data.incidents.map((i) => (
                <CircleMarker key={i.id} center={[i.latitude, i.longitude]} radius={8} pathOptions={{ color: "#EF4444", fillColor: "#EF4444", fillOpacity: 0.85 }}>
                  <Popup>
                    <p className="font-medium">{i.title}</p>
                    <p className="text-xs">Severity: {i.severity} · Status: {i.status}</p>
                    <p className="text-xs">{new Date(i.createdAt).toLocaleString("en-US")}</p>
                    <Link href={`/incidents/${i.id}`} className="text-xs text-eiq-blue">
                      View Details →
                    </Link>
                  </Popup>
                </CircleMarker>
              ))}
          </MapContainer>
        )}
      </div>

      <div className="w-56 shrink-0 rounded-lg border border-eiq-border bg-eiq-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-eiq-text-primary">Map layers</h2>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showStations} onChange={(e) => setShowStations(e.target.checked)} />
            <span className="h-2.5 w-2.5 rounded-full bg-[#9CA3AF]" /> Polling Stations ({data.polling.length})
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showCheckIns} onChange={(e) => setShowCheckIns(e.target.checked)} />
            <span className="h-2.5 w-2.5 rounded-full bg-eiq-success" /> Observer Check-ins ({data.checkIns.length})
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showReports} onChange={(e) => setShowReports(e.target.checked)} />
            <span className="h-2.5 w-2.5 rounded-full bg-eiq-info" /> Field Reports ({data.reports.length})
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showIncidents} onChange={(e) => setShowIncidents(e.target.checked)} />
            <span className="h-2.5 w-2.5 rounded-full bg-eiq-critical" /> Incidents ({data.incidents.length})
          </label>
        </div>
        <p className="mt-4 text-xs text-eiq-text-secondary">
          Region/constituency/status/report-type/date-range filtering is planned but not built in this
          pass -- only the layer toggles above are live right now.
        </p>
      </div>
    </div>
  );
}

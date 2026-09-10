"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Popup } from "react-leaflet";
import type { Layer, LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchUnitsAtDepth, fetchPollingCenterPoints } from "@/lib/actions/gis";
import type { UnitGeoFeature, PollingCenterPoint } from "@/lib/gis";

const LEVEL_LABELS = ["Region", "Constituency", "Ward"];
const KARIBU_CENTER: [number, number] = [-1.0, 37.0]; // [lat, lng]

function colorFor(registeredVoters: number, max: number) {
  if (max === 0) return "#334155";
  const t = Math.min(1, registeredVoters / max);
  // Interpolate from the panel navy toward the accent blue as voter count rises.
  const from = { r: 0x11, g: 0x1f, b: 0x30 };
  const to = { r: 0x2f, g: 0x80, b: 0xed };
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

type Breadcrumb = { depth: number; parentId?: string; label: string };

export function ElectionMap() {
  const [trail, setTrail] = useState<Breadcrumb[]>([{ depth: 0, label: "All Regions" }]);
  const [units, setUnits] = useState<UnitGeoFeature[]>([]);
  const [points, setPoints] = useState<PollingCenterPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const current = trail[trail.length - 1];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchUnitsAtDepth(current.depth, current.parentId).then((data) => {
      if (!cancelled) {
        setUnits(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [current.depth, current.parentId]);

  useEffect(() => {
    fetchPollingCenterPoints().then(setPoints);
  }, []);

  const maxVoters = useMemo(
    () => Math.max(1, ...units.map((u) => u.registeredVoters)),
    [units]
  );

  const featureCollection = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: units
        .filter((u) => u.geojson)
        .map((u) => ({
          type: "Feature" as const,
          properties: { id: u.id, name: u.name, registeredVoters: u.registeredVoters, pollingStationCount: u.pollingStationCount },
          geometry: u.geojson!,
        })),
    }),
    [units]
  );

  function styleFeature(feature?: GeoJSON.Feature) {
    const registeredVoters = (feature?.properties?.registeredVoters as number) ?? 0;
    return {
      fillColor: colorFor(registeredVoters, maxVoters),
      fillOpacity: 0.65,
      color: "#2F80ED",
      weight: 1,
    };
  }

  function onEachFeature(feature: GeoJSON.Feature, layer: Layer) {
    const props = feature.properties as { id: string; name: string; registeredVoters: number; pollingStationCount: number };
    layer.bindPopup(
      `<strong>${props.name}</strong><br/>${props.registeredVoters.toLocaleString(
        "en-US"
      )} registered voters<br/>${props.pollingStationCount} polling station(s)`
    );
    if (current.depth < 2) {
      layer.on("click", (e: LeafletMouseEvent) => {
        e.target.closePopup();
        setTrail([...trail, { depth: current.depth + 1, parentId: props.id, label: props.name }]);
      });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {trail.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-neutral">/</span>}
            <button
              className={i === trail.length - 1 ? "text-light" : "text-accent hover:underline"}
              onClick={() => setTrail(trail.slice(0, i + 1))}
              disabled={i === trail.length - 1}
            >
              {crumb.label}
            </button>
          </span>
        ))}
        {trail.length > 1 && (
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => setTrail([{ depth: 0, label: "All Regions" }])}
          >
            Reset to national view
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div style={{ height: 560, width: "100%" }} className="overflow-hidden rounded-lg">
            <MapContainer center={KARIBU_CENTER} zoom={7} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {featureCollection.features.length > 0 && (
                <GeoJSON
                  key={`${current.depth}-${current.parentId ?? "root"}`}
                  data={featureCollection}
                  style={styleFeature}
                  onEachFeature={onEachFeature}
                />
              )}
              {points.map((p) => (
                <CircleMarker
                  key={p.id}
                  center={[p.latitude, p.longitude]}
                  radius={5}
                  pathOptions={{ color: "#F7F9FC", fillColor: "#22C55E", fillOpacity: 0.9, weight: 1 }}
                >
                  <Popup>
                    <strong>{p.name}</strong>
                    <br />
                    {p.stationCount} station(s), {p.registeredVoters.toLocaleString("en-US")} voters
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-neutral">
        {loading
          ? "Loading…"
          : `Showing ${units.length} ${LEVEL_LABELS[current.depth].toLowerCase()}${units.length === 1 ? "" : "s"}. Click a shape to drill down. Green dots are polling centers.`}
      </p>
    </div>
  );
}

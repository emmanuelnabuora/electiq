"use client";

import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { Layer } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PublicRegionGeo } from "@/lib/public/queries";

const KARIBU_CENTER: [number, number] = [-1.0, 37.0];

function colorFor(turnoutPct: number) {
  const t = Math.min(1, turnoutPct / 100);
  const from = { r: 0x11, g: 0x1f, b: 0x30 };
  const to = { r: 0x22, g: 0xc5, b: 0x5e };
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function PublicMap({ regions }: { regions: PublicRegionGeo[] }) {
  const featureCollection = {
    type: "FeatureCollection" as const,
    features: regions
      .filter((r) => r.geojson)
      .map((r) => ({
        type: "Feature" as const,
        properties: { name: r.unitName, turnoutPct: r.turnoutPct, publishedStations: r.publishedStations, totalStations: r.totalStations },
        geometry: r.geojson!,
      })),
  };

  function style(feature?: GeoJSON.Feature) {
    const turnoutPct = (feature?.properties?.turnoutPct as number) ?? 0;
    return { fillColor: colorFor(turnoutPct), fillOpacity: 0.65, color: "#2F80ED", weight: 1 };
  }

  function onEachFeature(feature: GeoJSON.Feature, layer: Layer) {
    const p = feature.properties as { name: string; turnoutPct: number; publishedStations: number; totalStations: number };
    layer.bindPopup(
      `<strong>${p.name}</strong><br/>${p.turnoutPct.toFixed(1)}% turnout (published stations)<br/>${p.publishedStations}/${p.totalStations} stations published`
    );
  }

  return (
    <div style={{ height: 500, width: "100%" }} className="overflow-hidden rounded-lg">
      <MapContainer center={KARIBU_CENTER} zoom={7} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {featureCollection.features.length > 0 && (
          <GeoJSON data={featureCollection} style={style} onEachFeature={onEachFeature} />
        )}
      </MapContainer>
    </div>
  );
}

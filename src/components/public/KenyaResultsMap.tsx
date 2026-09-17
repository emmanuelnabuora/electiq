"use client";

import { useMemo, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { Layer, LeafletMouseEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PublicRegionGeo } from "@/lib/public/queries";
import { MapPinOff } from "lucide-react";

const KENYA_CENTER: [number, number] = [0.0236, 37.9062]; // [lat, lng]

function colorFor(turnoutPct: number) {
  // Color intensity represents turnout only -- never a party, candidate,
  // or any inference about who's ahead. Section requirement: "Do not
  // infer political conclusions from colors."
  const t = Math.min(1, turnoutPct / 100);
  const from = { r: 0xe4, g: 0xea, b: 0xf2 }; // pub-border
  const to = { r: 0x25, g: 0x63, b: 0xeb }; // pub-blue
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Real Kenya county boundary polygons are not available in this
 * database or repository -- confirmed directly (a database query
 * found zero counties with boundary geometry) and confirmed there's no
 * bundled GeoJSON asset to fall back to. Checked the npm registry for a
 * ready-made package before concluding this: the one plausible-sounding
 * result (osm-kenya-boundaries) turned out, on inspection of its actual
 * type definitions, to contain only {code, name} hierarchy data with no
 * geometry field at all -- not usable for a map despite its name.
 *
 * This component is built to actually render real polygons the moment
 * they exist (color-coded by turnout only, per the requirement not to
 * imply any political conclusion from color) -- it is not only a
 * placeholder. It renders the honest "boundary data unavailable" state
 * below only when every region it's given has a null geojson field,
 * which is what getPublicRegionsWithBoundaries already correctly
 * returns for a country with no boundary data, rather than inventing
 * approximate shapes to fill the gap.
 *
 * To complete this: source a verified Kenya county boundary dataset
 * (e.g. Kenya's own government open-data GIS portal, or a vetted
 * humanitarian/OSM extract with a clear license) and populate
 * AdministrativeUnit.boundary for Kenya's counties the same way the
 * demo country's 3 regions already have real PostGIS polygons.
 */
export function KenyaResultsMap({ regions }: { regions: PublicRegionGeo[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const hasBoundaries = regions.some((r) => r.geojson !== null);

  const featureCollection = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: regions
        .filter((r) => r.geojson !== null)
        .map((r) => ({
          type: "Feature" as const,
          properties: { unitId: r.unitId, unitName: r.unitName, turnoutPct: r.turnoutPct },
          geometry: r.geojson!,
        })),
    }),
    [regions]
  );

  if (!hasBoundaries) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-pub-border bg-pub-bg text-center">
        <MapPinOff className="h-6 w-6 text-pub-text-secondary" />
        <p className="max-w-xs text-sm text-pub-text-secondary">
          County boundary map data is not yet available for this election.
        </p>
        <p className="max-w-xs text-xs text-pub-text-secondary">
          A verified Kenya county boundary dataset is needed to enable this map — the county results
          table alongside it uses the same real data and is available now.
        </p>
      </div>
    );
  }

  function onEachFeature(
    feature: GeoJSON.Feature<GeoJSON.Geometry, { unitId: string; unitName: string; turnoutPct: number }>,
    layer: Layer
  ) {
    layer.bindTooltip(`${feature.properties.unitName} — ${feature.properties.turnoutPct.toFixed(1)}% turnout`);
    layer.on({
      mouseover: () => setHovered(feature.properties.unitId),
      mouseout: () => setHovered(null),
      click: (e: LeafletMouseEvent) => e.target.openTooltip(),
    });
  }

  return (
    <div className="h-72 overflow-hidden rounded-lg">
      <MapContainer center={KENYA_CENTER} zoom={6} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer attribution="" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <GeoJSON
          data={featureCollection}
          style={(feature) => ({
            fillColor: feature ? colorFor(feature.properties.turnoutPct) : "#E4EAF2",
            fillOpacity: feature?.properties.unitId === hovered ? 0.9 : 0.7,
            color: "#FFFFFF",
            weight: 1,
          })}
          onEachFeature={onEachFeature as (feature: GeoJSON.Feature, layer: Layer) => void}
        />
      </MapContainer>
    </div>
  );
}

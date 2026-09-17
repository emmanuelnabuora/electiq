"use client";

// Same reason as src/components/map/election-map-loader.tsx: Next.js 15
// requires the ssr:false dynamic import to live inside a Client
// Component boundary, and Leaflet touches `window` at import time so it
// must never be evaluated on the server.
import dynamic from "next/dynamic";

export const KenyaResultsMap = dynamic(
  () => import("@/components/public/KenyaResultsMap").then((m) => m.KenyaResultsMap),
  { ssr: false, loading: () => <p className="text-sm text-pub-text-secondary">Loading map…</p> }
);

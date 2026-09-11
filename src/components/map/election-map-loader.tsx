"use client";

// Next.js 15: `ssr: false` with next/dynamic is no longer allowed inside a
// Server Component (it silently worked as a deprecation warning in 14,
// now it's a hard build error) — the dynamic-import-with-no-SSR call has
// to live in a Client Component boundary, so this thin wrapper is that
// boundary. Leaflet touches `window` at import time and must never be
// evaluated on the server.
import dynamic from "next/dynamic";

export const ElectionMap = dynamic(
  () => import("@/components/map/election-map").then((m) => m.ElectionMap),
  { ssr: false, loading: () => <p className="text-sm text-neutral">Loading map…</p> }
);

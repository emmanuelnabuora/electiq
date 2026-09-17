"use client";

// Same reason as the other Leaflet loaders in this project: Leaflet
// touches `window` at import time and Next.js 15 requires the
// ssr:false dynamic import to live in its own Client Component
// boundary.
import dynamic from "next/dynamic";

export const FieldOperationsMap = dynamic(
  () => import("@/components/field/FieldOperationsMap").then((m) => m.FieldOperationsMap),
  { ssr: false, loading: () => <p className="text-sm text-eiq-text-secondary">Loading map…</p> }
);

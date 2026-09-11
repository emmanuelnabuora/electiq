"use client";

// Same reasoning as election-map-loader.tsx: Next.js 15 requires the
// `ssr: false` dynamic-import boundary to live in a Client Component.
import dynamic from "next/dynamic";

export const PublicMap = dynamic(
  () => import("@/components/public/public-map").then((m) => m.PublicMap),
  { ssr: false, loading: () => <p className="text-sm text-neutral">Loading map…</p> }
);

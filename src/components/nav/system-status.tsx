"use client";

import { useEffect, useState } from "react";

export function SystemStatus() {
  const [status, setStatus] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) => (r.ok ? "ok" : "down"))
      .catch(() => "down")
      .then((s) => {
        if (!cancelled) setStatus(s as "ok" | "down");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const color = status === "ok" ? "bg-success" : status === "down" ? "bg-critical" : "bg-neutral";
  const label = status === "ok" ? "System online" : status === "down" ? "System degraded" : "Checking…";

  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

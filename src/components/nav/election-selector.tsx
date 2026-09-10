"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ElectionOption = { id: string; name: string; status: string };

const STATUS_TONE: Record<string, "neutral" | "accent" | "success" | "warning"> = {
  DRAFT: "neutral",
  CONFIGURED: "accent",
  ACTIVE: "success",
  CLOSED: "warning",
  ARCHIVED: "neutral",
};

export function ElectionSelector({ elections }: { elections: ElectionOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedId = searchParams.get("electionId") || elections[0]?.id;
  const selected = elections.find((e) => e.id === selectedId) ?? elections[0];

  if (!selected) return null;

  function handleChange(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("electionId", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <select
          value={selected.id}
          onChange={(e) => handleChange(e.target.value)}
          aria-label="Select election"
          className="appearance-none rounded-md border border-white/10 bg-navy-secondary py-1.5 pl-3 pr-8 text-sm text-light"
        >
          {elections.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral" />
      </div>
      <Badge tone={STATUS_TONE[selected.status] ?? "neutral"}>{selected.status}</Badge>
    </div>
  );
}

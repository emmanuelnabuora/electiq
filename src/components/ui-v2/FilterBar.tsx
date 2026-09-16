"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function FilterBar({
  param,
  options,
}: {
  param: string;
  options: { label: string; value: string }[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? options[0]?.value;

  return (
    <div className="mb-4 flex gap-1 border-b border-eiq-border">
      {options.map((opt) => {
        const params = new URLSearchParams(searchParams.toString());
        if (opt.value === options[0].value) params.delete(param);
        else params.set(param, opt.value);
        const href = params.toString() ? `${pathname}?${params.toString()}` : pathname;
        const isActive = current === opt.value;
        return (
          <Link
            key={opt.value}
            href={href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-eiq-blue text-eiq-blue font-medium"
                : "border-transparent text-eiq-text-secondary hover:text-eiq-text-primary"
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}

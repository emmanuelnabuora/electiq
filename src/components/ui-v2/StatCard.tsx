import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  sublabel?: ReactNode;
  icon?: LucideIcon;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="rounded-lg border border-eiq-border bg-eiq-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm text-eiq-text-secondary">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-eiq-text-secondary" />}
      </div>
      <p className="mt-1 text-2xl font-semibold text-eiq-text-primary">{value}</p>
      {(sublabel || trend) && (
        <div className="mt-1 flex items-center gap-2 text-xs text-eiq-text-secondary">
          {sublabel}
          {trend && (
            <span className={trend.positive ? "text-eiq-success" : "text-eiq-critical"}>
              {trend.positive ? "+" : ""}
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

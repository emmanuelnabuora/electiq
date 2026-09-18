import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  trend,
  locked,
  lockedHint,
}: {
  label: string;
  value: string | number;
  sublabel?: ReactNode;
  icon?: LucideIcon;
  trend?: { value: string; positive: boolean };
  /**
   * Matches the original Command Center dashboard's KpiCard "locked"
   * treatment for a permission the viewer doesn't hold (e.g. Integrity
   * Alerts without integrity.read) -- shows a lock icon and a
   * lockedHint tooltip instead of the real number, rather than either
   * hiding the card (which would make the layout jump around per
   * viewer) or silently showing a value the viewer isn't authorized to
   * see (the value itself is never computed for a locked card by the
   * caller in the first place).
   */
  locked?: boolean;
  lockedHint?: string;
}) {
  return (
    <div className="rounded-lg border border-eiq-border bg-eiq-card p-4 shadow-sm" title={locked ? lockedHint : undefined}>
      <div className="flex items-start justify-between">
        <p className="text-sm text-eiq-text-secondary">{label}</p>
        {locked ? <Lock className="h-4 w-4 text-eiq-text-secondary" /> : Icon && <Icon className="h-4 w-4 text-eiq-text-secondary" />}
      </div>
      <p className="mt-1 text-2xl font-semibold text-eiq-text-primary">{locked ? "—" : value}</p>
      {(sublabel || trend) && !locked && (
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
      {locked && lockedHint && <p className="mt-1 text-xs text-eiq-text-secondary">{lockedHint}</p>}
    </div>
  );
}

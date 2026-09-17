import type { LucideIcon } from "lucide-react";

export function PublicStatCard({
  label,
  value,
  sublabel,
  icon: Icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-pub-border bg-pub-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-pub-blue/10 text-pub-blue">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-pub-text-secondary">{label}</p>
          <p className="text-xl font-semibold text-pub-text">{value}</p>
        </div>
      </div>
      {sublabel && <p className="mt-2 text-xs text-pub-text-secondary">{sublabel}</p>}
    </div>
  );
}

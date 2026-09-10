import { LucideIcon, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "blue" | "green" | "purple" | "teal" | "red" | "amber" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  blue: "bg-accent/15 text-accent",
  green: "bg-success/15 text-success",
  purple: "bg-[#7c5cff]/15 text-[#a996ff]",
  teal: "bg-[#14b8a6]/15 text-[#5eead4]",
  red: "bg-critical/15 text-critical",
  amber: "bg-warning/15 text-warning",
  neutral: "bg-white/5 text-neutral",
};

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  locked,
  lockedHint,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  locked?: boolean;
  lockedHint?: string;
}) {
  return (
    <Card className={cn(locked && "opacity-60")}>
      <CardContent className="flex items-start gap-3 py-4">
        {Icon && (
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", TONE_CLASSES[tone])}>
            {locked ? <Lock className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-light">{value}</p>
          {(hint || lockedHint) && (
            <p className="mt-0.5 truncate text-xs text-neutral">{locked ? lockedHint : hint}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

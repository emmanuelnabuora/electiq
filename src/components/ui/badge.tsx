import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "critical" | "accent";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-white/5 text-neutral",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  critical: "bg-critical/15 text-critical",
  accent: "bg-accent/15 text-accent",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

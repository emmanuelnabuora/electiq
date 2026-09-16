import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "critical";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  info: "bg-blue-50 text-eiq-info",
  success: "bg-green-50 text-eiq-success",
  warning: "bg-amber-50 text-eiq-warning",
  critical: "bg-red-50 text-eiq-critical",
};

/**
 * Maps real backend enum values to a display label and a color tone.
 * Deliberately conservative with language for anything touching
 * incidents/integrity: never "fraud detected" or similar, matching the
 * design brief's explicit requirement to use neutral, human-review
 * framing until an authorized person has actually made a determination.
 */
const LABEL_OVERRIDES: Record<string, string> = {
  UNDER_REVIEW: "Under review",
  AWAITING_REVIEW: "Requires verification",
  VALIDATION_FAILED: "Data inconsistency detected",
  DISPUTED: "Human review required",
  FLAGGED: "Unusual pattern detected",
};

export function StatusBadge({ status, tone }: { status: string; tone: Tone }) {
  const label = LABEL_OVERRIDES[status] ?? status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        TONE_CLASSES[tone]
      )}
    >
      {label.toLowerCase()}
    </span>
  );
}

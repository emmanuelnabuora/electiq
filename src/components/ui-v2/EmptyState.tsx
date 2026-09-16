import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  message,
  icon: Icon = Inbox,
}: {
  message: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-eiq-border bg-eiq-card py-12 text-center">
      <Icon className="h-6 w-6 text-eiq-text-secondary" />
      <p className="text-sm text-eiq-text-secondary">{message}</p>
    </div>
  );
}

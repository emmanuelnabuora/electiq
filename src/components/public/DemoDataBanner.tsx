import { AlertTriangle } from "lucide-react";

/**
 * Required, visible disclosure that the figures on this page are the
 * ElectIQ demo/synthetic dataset, not an official election result --
 * per the explicit instruction that the interface may say "Republic of
 * Kenya" while all non-official development data stays visibly
 * identified as demo data. This banner is not conditional on anything
 * -- it renders whenever the underlying election is not a real,
 * authorized production dataset, and should be removed only once one
 * is actually connected.
 */
export function DemoDataBanner() {
  return (
    <div className="flex items-center justify-center gap-2 bg-pub-warning/10 px-4 py-2 text-center text-xs font-medium text-amber-800">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      DEMO DATA — NOT OFFICIAL ELECTION RESULTS. This page shows the ElectIQ development dataset.
    </div>
  );
}

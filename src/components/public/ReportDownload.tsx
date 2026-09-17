import Link from "next/link";
import { FileJson, Download } from "lucide-react";

type ReportRow = { title: string; description: string; href: string };

/**
 * The approved design describes these as PDF downloads. No PDF
 * generation exists anywhere in this project, and fabricating that
 * capability here -- even just the UI chrome implying it works -- would
 * be presenting something as real that isn't. Every row instead links
 * directly to the actual, already-verified public JSON API from
 * earlier phases, labeled honestly as JSON. Formatted PDF export is a
 * real, reasonable follow-up, not something to fake in the meantime.
 */
function reportRows(electionId: string): ReportRow[] {
  return [
    {
      title: "Presidential Results (JSON)",
      description: "Official published results",
      href: `/api/public/results?electionId=${electionId}`,
    },
    {
      title: "Results by County (JSON)",
      description: "County-level results",
      href: `/api/public/regions?electionId=${electionId}`,
    },
    {
      title: "Turnout Statistics (JSON)",
      description: "Detailed voter turnout data",
      href: `/api/public/summary?electionId=${electionId}`,
    },
    {
      title: "Latest Published Results (JSON)",
      description: "Most recently published station updates",
      href: `/api/public/updates?electionId=${electionId}`,
    },
  ];
}

export function ReportDownload({ electionId }: { electionId: string }) {
  return (
    <div id="downloads" className="rounded-xl border border-pub-border bg-pub-card p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-pub-text">Downloads & Reports</h2>
      <p className="mb-4 text-xs text-pub-text-secondary">
        Raw published data as JSON. Formatted PDF reports are planned but not built yet -- these links
        are real, working data exports, not placeholders.
      </p>
      <div className="flex flex-col divide-y divide-pub-border">
        {reportRows(electionId).map((r) => (
          <Link
            key={r.title}
            href={r.href}
            target="_blank"
            className="flex items-center gap-3 py-3 hover:bg-pub-bg"
          >
            <FileJson className="h-5 w-5 shrink-0 text-pub-blue" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-pub-text">{r.title}</p>
              <p className="truncate text-xs text-pub-text-secondary">{r.description}</p>
            </div>
            <Download className="h-4 w-4 shrink-0 text-pub-text-secondary" />
          </Link>
        ))}
      </div>
    </div>
  );
}

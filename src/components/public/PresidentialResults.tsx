import Link from "next/link";
import type { PublicCandidateStanding } from "@/lib/public/queries";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function PresidentialResults({ standings }: { standings: PublicCandidateStanding[] }) {
  const maxShare = Math.max(...standings.map((s) => s.sharePct), 1);

  return (
    <div className="rounded-xl border border-pub-border bg-pub-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-pub-text">Presidential Results</h2>
        <Link href="#" className="text-xs font-medium text-pub-blue">
          View full results →
        </Link>
      </div>

      {standings.length === 0 ? (
        <p className="py-6 text-center text-sm text-pub-text-secondary">
          No results have been published yet for this position.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {standings.map((s) => (
            <div key={s.fullName} className="flex items-center gap-3">
              {s.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.photoUrl} alt={s.fullName} className="h-10 w-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pub-blue/10 text-xs font-medium text-pub-blue">
                  {initials(s.fullName)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-pub-text">{s.fullName}</p>
                  <p className="shrink-0 text-sm font-semibold text-pub-text">{s.sharePct.toFixed(1)}%</p>
                </div>
                {s.partyAbbreviation && <p className="text-xs text-pub-text-secondary">{s.partyAbbreviation}</p>}
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-pub-bg">
                  <div
                    className="h-full rounded-full bg-pub-blue"
                    style={{ width: `${(s.sharePct / maxShare) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-pub-text-secondary">{s.votes.toLocaleString("en-US")} votes</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

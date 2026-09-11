import { getPublicElection, getPublicUpdates } from "@/lib/public/queries";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PublicUpdatesPage() {
  const election = await getPublicElection();
  if (!election) return <p className="text-sm text-neutral">No election configured yet.</p>;

  const positionName = election.positions.includes("President") ? "President" : election.positions[0];
  const updates = positionName ? await getPublicUpdates(election.id, positionName) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-light">Updates</h1>
        <p className="mt-1 text-sm text-neutral">
          Recent polling stations officially published for {election.name} — {positionName}.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 py-4">
          {updates.map((u, i) => (
            <div key={i} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 text-sm">
              <span className="text-light">
                {u.stationCode} <span className="text-neutral">— {u.unitName}</span>
              </span>
              <span className="text-xs text-neutral">{new Date(u.publishedAt).toLocaleString("en-US")}</span>
            </div>
          ))}
          {updates.length === 0 && <p className="text-sm text-neutral">No results have been published yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

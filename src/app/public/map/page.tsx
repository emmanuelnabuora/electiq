import { getPublicElection, getPublicRegionsWithBoundaries } from "@/lib/public/queries";
import { PublicMap } from "@/components/public/public-map-loader";

// Route segment config. This page reads live database state and must
// never be statically prerendered (see README's Known Limitations for
// why every public page needs this).
export const dynamic = "force-dynamic";

export default async function PublicMapPage() {
  const election = await getPublicElection();
  if (!election) return <p className="text-sm text-neutral">No election configured yet.</p>;

  const positionName = election.positions.includes("President") ? "President" : election.positions[0];
  const regions = positionName ? await getPublicRegionsWithBoundaries(election.id, positionName) : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-light">Map</h1>
        <p className="mt-1 text-sm text-neutral">
          Turnout by region, {election.name} — {positionName}. Based only on officially published results.
        </p>
      </div>
      <PublicMap regions={regions} />
    </div>
  );
}

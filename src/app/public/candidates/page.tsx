import { db } from "@/lib/db";
import { getPublicElection } from "@/lib/public/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function PublicCandidatesPage() {
  const election = await getPublicElection();
  if (!election) return <p className="text-sm text-neutral">No election configured yet.</p>;

  const positions = await db.electionPosition.findMany({
    where: { electionId: election.id },
    include: { candidates: { include: { party: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-light">Candidates</h1>
        <p className="mt-1 text-sm text-neutral">{election.name}</p>
      </div>

      {positions.map((position) => (
        <Card key={position.id}>
          <CardHeader>
            <CardTitle>{position.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 py-4">
            {position.candidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                <div className="flex items-center gap-3">
                  {c.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photoUrl} alt={c.fullName} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-light">
                      {c.fullName
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                  )}
                  <span className="text-light">{c.fullName}</span>
                </div>
                {c.party && <Badge>{c.party.abbreviation}</Badge>}
              </div>
            ))}
            {position.candidates.length === 0 && (
              <p className="text-sm text-neutral">No candidates registered for this position.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

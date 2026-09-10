import Link from "next/link";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

const STATUS_TONE = {
  DRAFT: "neutral",
  CONFIGURED: "accent",
  ACTIVE: "success",
  CLOSED: "warning",
  ARCHIVED: "neutral",
} as const;

export default async function ElectionsPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const canRead = await authorize(userId, "elections", "read");
  const canCreate = await authorize(userId, "elections", "create");

  if (!canRead) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to view elections (
          <code>elections.read</code>).
        </CardContent>
      </Card>
    );
  }

  const elections = await db.election.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      country: true,
      _count: { select: { positions: true, parties: true, candidates: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-light">Elections</h1>
          <p className="text-sm text-neutral">Configuration and setup for every election.</p>
        </div>
        {canCreate && (
          <Link href="/command-center/elections/new">
            <Button>
              <Plus className="h-4 w-4" />
              New Election
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardContent className="py-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-neutral">
                <th className="py-2 font-medium">Election</th>
                <th className="py-2 font-medium">Country</th>
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Positions</th>
                <th className="py-2 font-medium">Parties</th>
                <th className="py-2 font-medium">Candidates</th>
              </tr>
            </thead>
            <tbody>
              {elections.map((e) => (
                <tr key={e.id} className="border-t border-white/5">
                  <td className="py-2">
                    <Link
                      href={`/command-center/elections/${e.id}`}
                      className="text-light hover:text-accent"
                    >
                      {e.name}
                    </Link>
                  </td>
                  <td className="py-2 text-neutral">{e.country.name}</td>
                  <td className="py-2 text-neutral">
                    {e.electionDate.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="py-2">
                    <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
                  </td>
                  <td className="py-2 text-neutral">{e._count.positions}</td>
                  <td className="py-2 text-neutral">{e._count.parties}</td>
                  <td className="py-2 text-neutral">{e._count.candidates}</td>
                </tr>
              ))}
              {elections.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-neutral">
                    No elections configured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

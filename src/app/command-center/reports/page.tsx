import Link from "next/link";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { getCurrentElectionId } from "@/lib/elections/current";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, BarChart3 } from "lucide-react";

export default async function ReportsPage() {
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "results", "read");

  if (!canRead) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to view reports (<code>results.read</code>).
        </CardContent>
      </Card>
    );
  }

  const electionId = await getCurrentElectionId();
  const election = electionId ? await db.election.findUnique({ where: { id: electionId } }) : null;

  if (!election) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">No current election configured.</CardContent>
      </Card>
    );
  }

  const reportTypes = [
    {
      href: "/command-center/reports/results-summary",
      icon: BarChart3,
      title: "Results Summary",
      description: "Candidate standings and reporting progress for every position, as of right now.",
    },
    {
      href: "/command-center/reports/turnout-report",
      icon: FileText,
      title: "Turnout Report",
      description: "Regional turnout and reporting completion, computed only over stations that have reported.",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-light">Reports</h1>
        <p className="text-sm text-neutral">
          {election.name}. Every report is provisional as of the moment you open it — none of these
          are official, certified documents. Use your browser's print function to save a copy as
          PDF.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {reportTypes.map((r) => (
          <Link key={r.href} href={r.href}>
            <Card className="h-full transition-colors hover:border-accent/40">
              <CardContent className="flex flex-col gap-2 py-4">
                <r.icon className="h-5 w-5 text-accent" />
                <p className="font-medium text-light">{r.title}</p>
                <p className="text-sm text-neutral">{r.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

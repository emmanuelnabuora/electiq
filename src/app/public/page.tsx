import { Building2, Users, TrendingUp, CheckCircle2 } from "lucide-react";
import { getPublicElection, getPublicElectionSummary } from "@/lib/public/queries";
import { PublicHero } from "@/components/public/PublicHero";
import { PublicStatCard } from "@/components/public/PublicStatCard";

export const dynamic = "force-dynamic";

/**
 * Country display name shown in the hero -- the interface says
 * "Republic of Kenya" per the approved design, independent of which
 * election/country is actually configured as current in the database.
 * The DemoDataBanner (rendered by the layout above this page) is what
 * keeps the data itself honestly labeled; this constant is purely the
 * interface's own branding.
 */
const PORTAL_COUNTRY_NAME = "Republic of Kenya";

export default async function PublicResultsPage() {
  const election = await getPublicElection();
  if (!election) {
    return <p className="px-6 py-12 text-center text-sm text-pub-text-secondary">No election configured yet.</p>;
  }

  const positionName = election.positions.includes("President") ? "President" : election.positions[0];
  const summary = positionName
    ? await getPublicElectionSummary(election.id, positionName)
    : {
        totalPollingStations: 0,
        reportingPollingStations: 0,
        reportingPct: 0,
        totalRegisteredVoters: 0,
        totalValidVotes: 0,
        turnoutPct: 0,
      };

  return (
    <div className="flex flex-col">
      <PublicHero electionId={election.id} countryName={PORTAL_COUNTRY_NAME} />

      <section className="grid grid-cols-1 gap-4 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <PublicStatCard
          label="Polling Stations"
          value={summary.totalPollingStations.toLocaleString("en-US")}
          sublabel={`${summary.reportingPollingStations.toLocaleString("en-US")} reporting`}
          icon={Building2}
        />
        <PublicStatCard
          label="Valid Votes"
          value={summary.totalValidVotes.toLocaleString("en-US")}
          sublabel={`${summary.reportingPct.toFixed(0)}% of stations counted`}
          icon={Users}
        />
        <PublicStatCard
          label="Voter Turnout"
          value={`${summary.turnoutPct.toFixed(1)}%`}
          sublabel={`${summary.totalRegisteredVoters.toLocaleString("en-US")} eligible voters`}
          icon={TrendingUp}
        />
        <PublicStatCard
          label="Reporting"
          value={`${summary.reportingPct.toFixed(0)}%`}
          sublabel={`${summary.reportingPollingStations.toLocaleString("en-US")} / ${summary.totalPollingStations.toLocaleString("en-US")} stations`}
          icon={CheckCircle2}
        />
      </section>

      {/*
        Phase 3 adds the full results grid here: Presidential Results,
        Results by County, Reporting Progress, Voter Turnout by County,
        Latest Published Results, and Downloads & Reports -- all reusing
        the same getPublic* functions the KPI cards above already use.
        Intentionally not stubbed out with placeholder panels in the
        meantime, since an empty placeholder panel is its own kind of
        misleading content.
      */}
    </div>
  );
}

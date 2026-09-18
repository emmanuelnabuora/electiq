import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { ElectionMap } from "@/components/map/election-map-loader";

/**
 * Moved here from /command-center/election-map as part of the
 * master-spec redesign. ElectionMap itself keeps its existing dark-
 * theme Card/Button styling internally -- a real, working drilldown
 * map component, moved rather than rewritten. Added one genuine new
 * capability while touching this file: a real turnout color layer
 * (see fetchTurnoutByUnit in src/lib/actions/gis.ts), using the exact
 * same numbers the Turnout screen shows, alongside the existing
 * registered-voters layer.
 */
export default async function ElectionMapPage() {
  const session = await requireSession();
  const canRead = await authorize(session.user.id, "elections", "read");

  if (!canRead) {
    return (
      <AppShell>
        <PageHeader title="Election Map" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to view the election map (elections.read).
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Election Map"
        subtitle="Registered voters or turnout by region, with drill-down into constituencies and wards."
      />
      <ElectionMap />
    </AppShell>
  );
}

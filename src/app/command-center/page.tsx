import { redirect } from "next/navigation";

// The dashboard root moved to /dashboard as part of the UI redesign
// (Screen 1), and this consolidation pass retires the old duplicate
// implementation entirely rather than keeping both alive. Its own
// unique components (LiveResultsPanel, KpiCard, the
// /api/command-center route) were confirmed used nowhere else in the
// repository before being deleted -- see the consolidation commit.
export default function LegacyDashboardRootRedirect() {
  redirect("/dashboard");
}

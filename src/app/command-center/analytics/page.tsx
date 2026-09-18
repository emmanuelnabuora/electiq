import { redirect } from "next/navigation";

// Moved to /analytics as part of the master-spec redesign.
export default function LegacyAnalyticsRedirect() {
  redirect("/analytics");
}

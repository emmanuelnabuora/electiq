import { redirect } from "next/navigation";

// This page's functionality (browsing/filtering individual result
// submissions) moved to /results/submissions as part of the UI
// redesign. The new /results itself is a different, dashboard-style
// overview (Screen 3's design) that didn't exist before this redesign.
export default function LegacyResultsRedirect() {
  redirect("/results/submissions");
}

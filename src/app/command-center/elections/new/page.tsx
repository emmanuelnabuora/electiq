import { redirect } from "next/navigation";

// Moved to /elections/new as part of the UI redesign. Redirect kept so
// old bookmarks/links still work.
export default function LegacyNewElectionRedirect() {
  redirect("/elections/new");
}

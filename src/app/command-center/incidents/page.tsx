import { redirect } from "next/navigation";

// Moved to /incidents as part of the UI redesign, replacing this page
// in place. Redirect kept so old bookmarks/links still work.
export default function LegacyIncidentsRedirect() {
  redirect("/incidents");
}

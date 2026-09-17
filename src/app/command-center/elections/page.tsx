import { redirect } from "next/navigation";

// The Elections screen has moved to /elections as part of the UI
// redesign (replacing this page in place, not running two parallel
// versions). This redirect exists so old bookmarks/links to
// /command-center/elections keep working.
export default function LegacyElectionsRedirect() {
  redirect("/elections");
}

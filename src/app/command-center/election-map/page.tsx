import { redirect } from "next/navigation";

// Moved to /election-map as part of the master-spec redesign.
export default function LegacyElectionMapRedirect() {
  redirect("/election-map");
}

import { redirect } from "next/navigation";

// Moved to /polling-stations as part of the master-spec redesign.
export default function LegacyPollingStationsRedirect() {
  redirect("/polling-stations");
}

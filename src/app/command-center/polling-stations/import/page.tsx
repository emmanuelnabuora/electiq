import { redirect } from "next/navigation";

// Moved to /polling-stations/import as part of the master-spec redesign.
export default function LegacyPollingStationImportRedirect() {
  redirect("/polling-stations/import");
}

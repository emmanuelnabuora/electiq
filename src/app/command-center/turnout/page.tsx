import { redirect } from "next/navigation";

// Moved to /turnout as part of the master-spec redesign.
export default function LegacyTurnoutRedirect() {
  redirect("/turnout");
}

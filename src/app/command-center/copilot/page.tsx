import { redirect } from "next/navigation";

// Moved to /copilot as part of the master-spec redesign.
export default function LegacyCopilotRedirect() {
  redirect("/copilot");
}

import { redirect } from "next/navigation";

// Moved to /results/submissions/new as part of the UI redesign.
export default function LegacySubmitResultRedirect() {
  redirect("/results/submissions/new");
}

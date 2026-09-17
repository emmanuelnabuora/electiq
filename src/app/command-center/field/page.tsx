import { redirect } from "next/navigation";

// This page's functionality (observer assignments, check-in, field
// reporting) moved to /field-operations/assignments as part of the UI
// redesign. The new /field-operations itself is a different,
// map-focused overview (Screen 4's design) that didn't exist before.
export default function LegacyFieldOperationsRedirect() {
  redirect("/field-operations/assignments");
}

import { redirect } from "next/navigation";

// Moved to /integrity as part of the UI redesign.
export default function LegacyIntegrityRedirect() {
  redirect("/integrity");
}

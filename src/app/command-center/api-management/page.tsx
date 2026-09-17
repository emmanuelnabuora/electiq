import { redirect } from "next/navigation";

// Moved to /api-management as part of the UI redesign (Screen 7) --
// note the flat top-level route, not nested under /users, since API
// key management is a separate administrative capability.
export default function LegacyApiManagementRedirect() {
  redirect("/api-management");
}

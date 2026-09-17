import { redirect } from "next/navigation";

// Moved to /users/roles as part of the UI redesign (Screen 7).
export default function LegacyRolesRedirect() {
  redirect("/users/roles");
}

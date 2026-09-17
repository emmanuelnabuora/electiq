import { redirect } from "next/navigation";

// Moved to /users/permissions as part of the UI redesign (Screen 7).
export default function LegacyPermissionsRedirect() {
  redirect("/users/permissions");
}

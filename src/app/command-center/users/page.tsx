import { redirect } from "next/navigation";

// Moved to /users as part of the UI redesign (Screen 7).
export default function LegacyUsersRedirect() {
  redirect("/users");
}

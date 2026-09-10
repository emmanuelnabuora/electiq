import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

/** Reads the current session on the server. Returns null if unauthenticated. */
export async function getCurrentSession() {
  return getServerSession(authOptions);
}

/**
 * Use at the top of a protected server component. Redirects unauthenticated
 * requests to /login before any protected data is fetched or rendered —
 * authorization happens before the page body ever runs, not via hiding
 * elements client-side.
 */
export async function requireSession() {
  const session = await getCurrentSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

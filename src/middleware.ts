import { withAuth } from "next-auth/middleware";

// Route-level gate. This is a first line of defense only — the real
// authorization decision for any given action still happens server-side
// via src/lib/rbac.ts, never here and never in the client.
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  // Every route below also calls requireSession()/authorize() itself
  // server-side (the actual security boundary -- verified across every
  // page built in this redesign), so this matcher is defense-in-depth,
  // not the only gate: it just redirects an unauthenticated request one
  // layer earlier, before the page's own server component even runs.
  // Expanded to cover the new canonical routes from the redesign
  // (Screens 1-7) alongside the original /command-center and /elections
  // -- a real gap found during Screen 7's repository-wide stale-route
  // audit, not a new addition invented for this pass.
  matcher: [
    "/command-center/:path*",
    "/dashboard/:path*",
    "/elections/:path*",
    "/results/:path*",
    "/field-operations/:path*",
    "/incidents/:path*",
    "/integrity/:path*",
    "/users/:path*",
    "/api-management/:path*",
    "/admin/:path*",
  ],
};

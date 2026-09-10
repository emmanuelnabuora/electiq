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
  matcher: ["/command-center/:path*", "/elections/:path*", "/admin/:path*"],
};

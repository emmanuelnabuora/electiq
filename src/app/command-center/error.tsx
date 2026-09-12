"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Next.js App Router error boundary for everything under /command-center.
 * Before this existed, any thrown ActionError (see src/lib/actions/errors.ts
 * — used across 10+ action files for expected, user-facing conditions like
 * "this observer is already assigned to this polling station") surfaced as
 * a raw, unhandled 500 with a Next.js digest rather than a message anyone
 * could act on. This boundary catches all of those in one place instead of
 * needing every individual page to handle it.
 *
 * `error.message` is shown directly because every ActionError thrown in
 * this app is already written as a plain-language, safe-to-display
 * sentence (e.g. "This observer is already assigned to this polling
 * station") — never a raw exception message or stack detail.
 */
export default function CommandCenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Command Center error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <AlertTriangle className="h-8 w-8 text-warning" />
          <div>
            <p className="text-sm font-medium text-light">{error.message || "Something went wrong."}</p>
            {error.digest && (
              <p className="mt-1 text-xs text-neutral">Reference: {error.digest}</p>
            )}
          </div>
          <Button onClick={reset}>Try again</Button>
        </CardContent>
      </Card>
    </div>
  );
}

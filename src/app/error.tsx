"use client";

import { useEffect } from "react";
import { AlertIcon } from "@/components/ui/icons";

/**
 * Route-level error boundary.
 *
 * Without one, a throw in a server component renders Next's default error page
 * — unstyled, unbranded, and with no way back other than the browser button.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle on the server-side stack, which Next
    // deliberately withholds from the client in production.
    console.error("Route error:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-canvas">
      <div className="panel max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-well flex items-center justify-center mx-auto mb-5 bg-negative-soft text-negative-ink">
          <AlertIcon className="w-7 h-7" />
        </div>

        <h1 className="text-section mb-2">Something went wrong</h1>
        <p className="text-sm leading-relaxed mb-6 text-ink-secondary">
          This page could not be loaded. The problem has been logged.
        </p>

        {error.digest && (
          <p className="text-xs mb-6 font-mono text-ink-muted">
            Reference: {error.digest}
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary px-6">
            Try again
          </button>
          <a href="/" className="btn-outline">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

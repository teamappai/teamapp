"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * Root error boundary (Phase 16B). Catches errors thrown in the root layout
 * itself — the one place the regular `app/error.tsx` boundary can't reach. It
 * must render its own <html>/<body>. Errors are forwarded to Sentry (PII
 * scrubbed in beforeSend).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          Something went wrong
        </h1>
        <p
          style={{ maxWidth: "24rem", color: "#64748b", fontSize: "0.875rem" }}
        >
          An unexpected error occurred. Please reload the page or head back
          home.
        </p>
        <button
          type="button"
          onClick={() => {
            // A global error tears down the app shell, so a full reload back to
            // the home route is the most reliable recovery (no router context).
            window.location.href = "/";
          }}
          style={{
            border: "none",
            cursor: "pointer",
            borderRadius: "0.5rem",
            background: "#0f172a",
            padding: "0.5rem 1rem",
            color: "white",
            fontSize: "0.875rem",
          }}
        >
          Go home
        </button>
      </body>
    </html>
  );
}

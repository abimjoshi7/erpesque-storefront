"use client";

/**
 * The last resort: a failure in the root layout itself, which the per-shop
 * error boundary sits inside and therefore cannot catch.
 *
 * This file replaces the root layout while it is showing, so it has to render
 * its own `<html>` and `<body>` — and it gets none of the app's stylesheet or
 * fonts, which is why everything here is inline. A stylesheet that failed to
 * load is one of the things that can put a visitor on this page.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <main>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>
            The shop could not be loaded
          </h1>
          <p style={{ marginTop: "0.75rem", color: "#666" }}>
            Nothing has been ordered. Try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: "1.5rem",
              padding: "0.625rem 1.25rem",
              borderRadius: "0.375rem",
              border: "1px solid currentColor",
              background: "transparent",
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#999" }}>
              Reference {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}

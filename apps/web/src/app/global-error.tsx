"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          <h1 style={{ color: "var(--ds-red-700)", marginBottom: "1rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "var(--ds-gray-900)", marginBottom: "1rem" }}>
            {error.message}
          </p>
          {error.stack && (
            <pre
              style={{
                background: "var(--ds-background-200)",
                padding: "1rem",
                overflow: "auto",
                fontSize: "12px",
                marginBottom: "1rem",
              }}
            >
              {error.stack}
            </pre>
          )}
          <button
            onClick={reset}
            style={{
              background: "var(--ds-gray-1000)",
              color: "white",
              border: "none",
              padding: "0.5rem 1rem",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

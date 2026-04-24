import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry() {
  if (!dsn) return; // skip in dev when DSN is not configured

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Capture 100% of transactions in dev, 10% in production
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
    // Don't send errors caused by browser extensions or network blips
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "Network request failed",
      "Load failed",
    ],
  });
}

export { Sentry };

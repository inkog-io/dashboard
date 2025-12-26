/**
 * Sentry Server Configuration
 *
 * This file configures the initialization of Sentry on the server.
 * The config you add here will be used whenever the server handles a request.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN && process.env.NODE_ENV === "production",

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NODE_ENV,

  // Filter out non-critical errors
  beforeSend(event, hint) {
    // Don't send in development
    if (process.env.NODE_ENV === "development") {
      console.error("[Sentry Server Dev]", hint.originalException);
      return null;
    }

    return event;
  },

  // Set custom tags
  initialScope: {
    tags: {
      product: "inkog-dashboard",
      runtime: "server",
    },
  },
});

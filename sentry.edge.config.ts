/**
 * Sentry Edge Configuration
 *
 * This file configures the initialization of Sentry for edge features (middleware, edge routes).
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN && process.env.NODE_ENV === "production",

  // Performance Monitoring
  tracesSampleRate: 0.1,

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NODE_ENV,

  // Set custom tags
  initialScope: {
    tags: {
      product: "inkog-dashboard",
      runtime: "edge",
    },
  },
});

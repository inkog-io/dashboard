/**
 * Sentry Client Configuration
 *
 * This file configures the initialization of Sentry on the browser.
 * The config you add here will be used whenever a page is visited.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN && process.env.NODE_ENV === "production",

  // Performance Monitoring
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring

  // Session Replay
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NODE_ENV,

  // Integrations
  integrations: [
    Sentry.browserTracingIntegration({
      // Set custom transaction name for routes
      beforeStartSpan: (context) => ({
        ...context,
        name: context.name?.replace(/\[([^\]]+)\]/g, ':$1') || context.name,
      }),
    }),
    Sentry.replayIntegration({
      // Mask all text content for privacy
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filter out non-critical errors
  beforeSend(event, hint) {
    // Don't send errors in development
    if (process.env.NODE_ENV === "development") {
      console.error("[Sentry Dev]", hint.originalException);
      return null;
    }

    // Filter out common non-errors
    const error = hint.originalException;
    if (error instanceof Error) {
      // Ignore network errors from extensions
      if (error.message.includes("Extension context invalidated")) {
        return null;
      }
      // Ignore ResizeObserver errors
      if (error.message.includes("ResizeObserver")) {
        return null;
      }
    }

    return event;
  },

  // Ignore specific error types
  ignoreErrors: [
    // Network issues
    "Failed to fetch",
    "NetworkError",
    "Load failed",
    // Browser navigation
    "cancelled",
    "Aborted",
    // Third-party scripts
    "Script error",
    "Extension context invalidated",
    // Non-error rejections
    "Non-Error promise rejection captured",
  ],

  // Set custom tags
  initialScope: {
    tags: {
      product: "inkog-dashboard",
    },
  },
});

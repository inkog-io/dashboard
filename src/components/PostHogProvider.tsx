"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { hasConsented } from "@/lib/consent";

// Initialize PostHog — start in memory-only persistence by default.
// Upgrade to localStorage+cookie when user accepts cookie consent.
if (typeof window !== "undefined") {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

  if (posthogKey) {
    const consented = hasConsented();
    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: consented ? "localStorage+cookie" : "memory",
      person_profiles: consented ? "always" : "identified_only",
    });
  }
}

function PostHogIdentify() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      // Capture anonymous ID before identify for session stitching
      const anonId = posthog.get_distinct_id();

      // Identify the user in PostHog
      posthog.identify(user.id, {
        email: user.emailAddresses[0]?.emailAddress,
        name: user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      });

      // Stitch anonymous session to authenticated user
      if (anonId && anonId !== user.id) {
        posthog.alias(user.id, anonId);
      }
    }
  }, [isLoaded, user]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}

// Export posthog for manual event tracking
export { posthog };

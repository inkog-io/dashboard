"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
// Initialize PostHog with full persistence — authenticated users
// accept Terms of Service at signup, no separate cookie consent needed.
if (typeof window !== "undefined") {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

  if (posthogKey) {
    posthog.init(posthogKey, {
      api_host: posthogHost,
      capture_pageview: true,
      capture_pageleave: true,
      persistence: "localStorage+cookie",
      person_profiles: "always",
    });
  }
}

function PostHogIdentify() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      // Capture anonymous ID before identify for session stitching
      const anonId = posthog.get_distinct_id();

      // Identify the user in PostHog.
      // Set BOTH the canonical PostHog properties ($email, $name) AND the
      // non-prefixed legacy ones — so PostHog person-UI / email targeting
      // works AND historical queries that hit `properties.email`/`properties.name`
      // continue to work.
      const email = user.emailAddresses[0]?.emailAddress;
      const name = user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim();
      posthog.identify(user.id, {
        email,
        name,
        $email: email,
        $name: name,
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

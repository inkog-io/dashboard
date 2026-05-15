"use client";

import { SignIn } from "@clerk/nextjs";
import { useEffect } from "react";
import Link from "next/link";
import { posthog } from "@/components/PostHogProvider";

/**
 * /sign-in — Clerk's hosted SignIn component.
 *
 * Investigation findings (2026-05-15):
 * - PostHog audit found 7 rage-clicks on app.inkog.io/sign-in over 30 days
 *   from 7 unique users — most-rage-clicked URL on the dashboard by 3.5×
 *   (next highest: /dashboard/results/<id> at 2).
 * - The page itself is a minimal wrapper around Clerk's <SignIn>; no custom
 *   error handling, no rate-limit messaging, no obvious "stuck" recovery.
 * - Likely causes of rage-clicking (cannot verify without Clerk session logs):
 *   1. Clerk component slow to load on cold start — user clicks before
 *      the form is interactive.
 *   2. Social login button (if used) returns a "verification in progress"
 *      state that doesn't clearly resolve.
 *   3. Email verification code flow — code field doesn't clearly indicate
 *      "submitted, waiting on backend."
 *
 * Mitigations applied here:
 * - Fire `sign_in_page_loaded` so we can compute "time on page before
 *   rage-click" via a future PostHog funnel.
 * - Render a visible "Trouble signing in? Email help@inkog.io" escape hatch
 *   so users with broken Clerk flows have an out.
 * - Note: deeper fix requires Clerk dashboard config inspection (verify
 *   email/password vs OAuth flow settings) — outside this code's scope.
 */
export default function SignInPage({
  searchParams,
}: {
  searchParams: { redirect_url?: string };
}) {
  useEffect(() => {
    posthog.capture("sign_in_page_loaded", {
      has_redirect: Boolean(searchParams.redirect_url),
    });
  }, [searchParams.redirect_url]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 px-4 py-12">
      <SignIn
        fallbackRedirectUrl={searchParams.redirect_url || "/dashboard"}
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg",
          },
        }}
      />
      <div className="text-sm text-zinc-500 text-center max-w-md">
        Trouble signing in?{" "}
        <Link
          href="mailto:help@inkog.io"
          className="text-primary hover:underline"
          onClick={() => posthog.capture("sign_in_help_clicked")}
        >
          Email help@inkog.io
        </Link>
        {" "}— we typically reply within a few hours.
      </div>
    </div>
  );
}

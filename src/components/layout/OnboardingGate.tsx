"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useApiKeyStatus } from "@/hooks/useApiKeyStatus";

interface OnboardingGateProps {
  children: React.ReactNode;
}

// Must match the key used in analytics.ts
const ONBOARDING_STORAGE_KEY = "inkog_onboarding_state";

/**
 * Gates access to dashboard until user has at least one API key.
 *
 * Modern SaaS pattern (Vercel, Supabase, Linear):
 * - Don't show empty dashboards to new users
 * - Force completion of critical setup steps
 * - The onboarding IS the first experience, not a skippable detour
 *
 * Users without API keys are redirected to /dashboard/onboarding.
 * Once they have a key (or completed onboarding), they're unblocked.
 */
export function OnboardingGate({ children }: OnboardingGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { hasKeys, loading, error } = useApiKeyStatus();
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);

  // Check localStorage for onboarding completion (client-side only)
  // Reads from the same key used by analytics.ts
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        setHasCompletedOnboarding(state.hasCompletedOnboarding === true);
      } else {
        setHasCompletedOnboarding(false);
      }
    } catch {
      // Invalid stored state
      setHasCompletedOnboarding(false);
    }
  }, []);

  // Routes that bypass the gate:
  // - /dashboard/onboarding: The onboarding flow itself
  // - /dashboard/api-keys: Manual key creation
  // - /dashboard/scan: Let users try Inkog immediately (fastest time-to-value)
  // - /dashboard/results: Let users see their scan results
  const bypassRoutes = [
    "/dashboard/onboarding",
    "/dashboard/api-keys",
    "/dashboard/scan",
    "/dashboard/results",
  ];
  const shouldBypass = bypassRoutes.some(route => pathname.startsWith(route));

  useEffect(() => {
    // Don't redirect if:
    // - Still loading (don't know yet)
    // - Onboarding completion state not yet loaded from localStorage
    // - On a bypass route (onboarding or api-keys page)
    // - There was an error checking (fail open, don't block legitimate users)
    // - User already has keys
    // - User has completed onboarding (even without keys)
    if (loading || hasCompletedOnboarding === null || shouldBypass || error || hasKeys || hasCompletedOnboarding) {
      return;
    }

    // No keys, not on bypass route, hasn't completed onboarding → redirect to onboarding
    router.replace("/dashboard/onboarding");
  }, [hasKeys, loading, error, shouldBypass, hasCompletedOnboarding, router]);

  // Show loading state while checking (prevents flash of dashboard)
  if ((loading || hasCompletedOnboarding === null) && !shouldBypass) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // If no keys, not completed onboarding, and not on bypass route, show loading while redirect happens
  if (!hasKeys && !hasCompletedOnboarding && !shouldBypass && !error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          <p className="text-sm text-gray-500">Setting up your workspace...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

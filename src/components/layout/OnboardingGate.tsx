"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useApiKeyStatus } from "@/hooks/useApiKeyStatus";

interface OnboardingGateProps {
  children: React.ReactNode;
}

/**
 * Gates access to dashboard until user has at least one API key.
 *
 * Modern SaaS pattern (Vercel, Supabase, Linear):
 * - Don't show empty dashboards to new users
 * - Force completion of critical setup steps
 * - The onboarding IS the first experience, not a skippable detour
 *
 * Users without API keys are redirected to /dashboard/onboarding.
 * Once they have a key, they're unblocked.
 */
export function OnboardingGate({ children }: OnboardingGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { hasKeys, loading, error } = useApiKeyStatus();

  // Routes that bypass the gate (onboarding itself, and API keys page for manual setup)
  const bypassRoutes = ["/dashboard/onboarding", "/dashboard/api-keys"];
  const shouldBypass = bypassRoutes.some(route => pathname.startsWith(route));

  useEffect(() => {
    // Don't redirect if:
    // - Still loading (don't know yet)
    // - On a bypass route (onboarding or api-keys page)
    // - There was an error checking (fail open, don't block legitimate users)
    // - User already has keys
    if (loading || shouldBypass || error || hasKeys) {
      return;
    }

    // No keys, not on bypass route → redirect to onboarding
    router.replace("/dashboard/onboarding");
  }, [hasKeys, loading, error, shouldBypass, router]);

  // Show loading state while checking (prevents flash of dashboard)
  if (loading && !shouldBypass) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // If no keys and not on bypass route, show loading while redirect happens
  if (!hasKeys && !shouldBypass && !error) {
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

"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { createAPIClient } from "@/lib/api";

interface ActivationGuardProps {
  children: React.ReactNode;
}

/**
 * ActivationGuard checks if the user is "activated" (has any scans or API keys).
 * If not, redirects to onboarding. This runs on ALL dashboard pages.
 *
 * A user is "activated" when they have:
 * - At least one scan in history, OR
 * - At least one API key
 *
 * This ensures users see onboarding first, but once they do ANYTHING,
 * they never get redirected back to onboarding.
 */
export function ActivationGuard({ children }: ActivationGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { getToken } = useAuth();
  const [checking, setChecking] = useState(true);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    const checkActivation = async () => {
      // Skip check if already on onboarding page
      if (pathname === "/dashboard/onboarding") {
        setChecking(false);
        setActivated(true); // Allow access to onboarding
        return;
      }

      // Skip check if coming from completed onboarding
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("completed") === "true") {
        setChecking(false);
        setActivated(true);
        return;
      }

      try {
        const api = createAPIClient(getToken);

        // Check if user has any activity (scans or API keys)
        const [historyResponse, keysResponse] = await Promise.all([
          api.history.list({ limit: 1 }),
          api.keys.list(),
        ]);

        const hasScans = (historyResponse.scans?.length ?? 0) > 0;
        const hasKeys = (keysResponse.api_keys?.length ?? 0) > 0;
        const hasActivity = hasScans || hasKeys;

        if (!hasActivity) {
          // New user with no activity - redirect to onboarding
          router.replace("/dashboard/onboarding");
          return;
        }

        // User is activated
        setActivated(true);
      } catch (err) {
        // On error, allow access (don't block users due to API issues)
        console.error("Activation check failed:", err);
        setActivated(true);
      } finally {
        setChecking(false);
      }
    };

    checkActivation();
  }, [getToken, pathname, router]);

  // Show loading while checking
  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent" />
      </div>
    );
  }

  // If not activated and not on onboarding, we're redirecting
  if (!activated && pathname !== "/dashboard/onboarding") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

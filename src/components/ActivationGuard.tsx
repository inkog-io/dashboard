"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { createAPIClient } from "@/lib/api";

interface ActivationGuardProps {
  children: React.ReactNode;
}

/**
 * ActivationGuard - Simple activation check based on scan history.
 *
 * Activation logic:
 * - User is "activated" when they have completed at least 1 scan
 * - New users (0 scans) are redirected to onboarding
 * - Once activated, user never sees onboarding redirect again
 *
 * Bypass routes (always allowed):
 * - /dashboard/onboarding - The onboarding page itself
 * - /dashboard/scan - Let users complete their first scan
 * - /dashboard/api-keys - Let users create API keys
 *
 * The ?completed=true param also bypasses the check (used after onboarding).
 */
export function ActivationGuard({ children }: ActivationGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { getToken } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkActivation = async () => {
      // Bypass routes - always allow access
      const bypassRoutes = [
        "/dashboard/onboarding",
        "/dashboard/scan",
        "/dashboard/api-keys",
        "/dashboard/results", // Allow viewing results
      ];

      const shouldBypass = bypassRoutes.some(route => pathname.startsWith(route));
      if (shouldBypass) {
        setChecking(false);
        return;
      }

      // Check for ?completed=true (just finished onboarding)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("completed") === "true") {
        setChecking(false);
        return;
      }

      try {
        const api = createAPIClient(getToken);

        // Single API call - check for any scans
        const response = await api.history.list({ limit: 1 });
        const hasScans = (response.scans?.length ?? 0) > 0;

        if (!hasScans) {
          // New user with no scans - redirect to onboarding
          router.replace("/dashboard/onboarding");
          return;
        }

        // User is activated (has scans)
        setChecking(false);
      } catch (err) {
        // On error, allow access (fail gracefully)
        if (process.env.NODE_ENV === "development") {
          console.error("Activation check failed:", err);
        }
        setChecking(false);
      }
    };

    checkActivation();
  }, [getToken, pathname, router]);

  // Show loading while checking
  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

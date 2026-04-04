"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { createAPIClient, type CurrentUser } from "@/lib/api";

interface CurrentUserState {
  user: CurrentUser | null;
  isAdmin: boolean;
  canAccessDeepScan: boolean;
  hasInkogRed: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch the current user's info including roles.
 * Provides `isAdmin` and `canAccessDeepScan` convenience booleans.
 */
export function useCurrentUser(): CurrentUserState {
  const { getToken, isSignedIn } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasInkogRed, setHasInkogRed] = useState(false);

  // Check localStorage for Inkog Red status (avoid SSR mismatch)
  useEffect(() => {
    setHasInkogRed(localStorage.getItem("inkog_linkedin_followed") === "true");
  }, []);

  const fetchUser = useCallback(async () => {
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const api = createAPIClient(getToken);
      const response = await api.me.get();
      setUser(response.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch user");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return {
    user,
    isAdmin: user?.roles?.includes("admin") ?? false,
    canAccessDeepScan: (user?.roles?.includes("admin") || user?.roles?.includes("deepscan")) ?? false,
    hasInkogRed,
    isLoading,
    error,
    refresh: fetchUser,
  };
}

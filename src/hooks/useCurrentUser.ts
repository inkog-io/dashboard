"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { createAPIClient, type CurrentUser } from "@/lib/api";

interface CurrentUserState {
  user: CurrentUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch the current user's info including role.
 * Provides `isAdmin` convenience boolean.
 */
export function useCurrentUser(): CurrentUserState {
  const { getToken, isSignedIn } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    isAdmin: user?.role === "admin",
    isLoading,
    error,
    refresh: fetchUser,
  };
}

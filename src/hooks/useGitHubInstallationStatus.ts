"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { createAPIClient } from "@/lib/api";

interface GitHubInstallationStatus {
  hasInstallations: boolean;
  installationCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to check if the user has any GitHub installations linked.
 * Used to show "Setup" badge in navigation.
 */
export function useGitHubInstallationStatus(): GitHubInstallationStatus {
  const { getToken, isSignedIn } = useAuth();
  const [hasInstallations, setHasInstallations] = useState(false);
  const [installationCount, setInstallationCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const api = createAPIClient(getToken);
      const response = await api.github.listInstallations();
      const count = response.installations.length;
      setInstallationCount(count);
      setHasInstallations(count > 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check GitHub installations");
      setHasInstallations(false);
      setInstallationCount(0);
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    hasInstallations,
    installationCount,
    loading,
    error,
    refetch: fetchStatus,
  };
}

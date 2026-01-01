"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { createAPIClient } from "@/lib/api";

interface ApiKeyStatus {
  hasKeys: boolean;
  keyCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to check if the user has any API keys.
 * Used to show "Setup Required" badge in navigation.
 */
export function useApiKeyStatus(): ApiKeyStatus {
  const { getToken, isSignedIn } = useAuth();
  const [hasKeys, setHasKeys] = useState(false);
  const [keyCount, setKeyCount] = useState(0);
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
      const response = await api.keys.list();
      const count = response.api_keys.length;
      setKeyCount(count);
      setHasKeys(count > 0);
    } catch (err) {
      // Don't treat this as a blocking error - user might just not have keys yet
      setError(err instanceof Error ? err.message : "Failed to check API keys");
      setHasKeys(false);
      setKeyCount(0);
    } finally {
      setLoading(false);
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    hasKeys,
    keyCount,
    loading,
    error,
    refetch: fetchStatus,
  };
}

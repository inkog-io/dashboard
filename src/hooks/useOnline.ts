/**
 * Online Status Hook
 *
 * Detects network connectivity and provides real-time online/offline status.
 * Shows a banner when offline to prevent confusion from failed API calls.
 */

"use client";

import { useState, useEffect, useCallback } from 'react';

interface OnlineStatus {
  /** Whether the browser reports being online */
  isOnline: boolean;
  /** Whether we've verified actual API connectivity (null = still checking) */
  isConnected: boolean | null;
  /** When the last successful connection was made */
  lastConnectedAt: Date | null;
  /** When connectivity was lost */
  offlineSince: Date | null;
  /** Force a connectivity check */
  checkConnection: () => Promise<boolean>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.inkog.io';

/**
 * Hook to monitor online/offline status
 *
 * @returns OnlineStatus object with connectivity information
 */
export function useOnline(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  // Start with null to indicate "checking" state - don't show banner until first check completes
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(
    typeof window !== 'undefined' ? new Date() : null
  );
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  const [failureCount, setFailureCount] = useState(0);

  /**
   * Check actual API connectivity by hitting the health endpoint
   */
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit', // Don't send cookies for health check
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setIsConnected(true);
        setLastConnectedAt(new Date());
        setOfflineSince(null);
        setFailureCount(0);
        return true;
      }
    } catch (err) {
      // Log in development for debugging
      if (process.env.NODE_ENV === 'development') {
        console.debug('[useOnline] Health check failed:', err);
      }
    }

    // Only mark as disconnected after 2 consecutive failures to avoid flaky detection
    setFailureCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 2) {
        setIsConnected(false);
        if (!offlineSince) {
          setOfflineSince(new Date());
        }
      }
      return newCount;
    });
    return false;
  }, [offlineSince]);

  // Handle browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Verify actual connectivity when browser says we're online
      checkConnection();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsConnected(false);
      if (!offlineSince) {
        setOfflineSince(new Date());
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial connectivity check
    checkConnection();

    // Periodic connectivity check every 30 seconds when online
    const interval = setInterval(() => {
      if (navigator.onLine) {
        checkConnection();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkConnection, offlineSince]);

  return {
    isOnline,
    isConnected,
    lastConnectedAt,
    offlineSince,
    checkConnection,
  };
}

/**
 * Format duration for display
 */
export function formatOfflineDuration(since: Date | null): string {
  if (!since) return '';

  const now = new Date();
  const diffMs = now.getTime() - since.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
}

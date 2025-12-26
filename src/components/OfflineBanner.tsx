/**
 * Offline Banner Component
 *
 * Displays a non-intrusive banner when the user is offline or the API is unreachable.
 * Automatically hides when connectivity is restored.
 */

"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { useOnline, formatOfflineDuration } from "@/hooks/useOnline";
import { useState } from "react";

export function OfflineBanner() {
  const { isOnline, isConnected, offlineSince, checkConnection } = useOnline();
  const [isChecking, setIsChecking] = useState(false);

  // Only show if offline or API unreachable
  if (isOnline && isConnected) {
    return null;
  }

  const handleRetry = async () => {
    setIsChecking(true);
    await checkConnection();
    setIsChecking(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-amber-50 dark:bg-amber-900/30 border-t border-amber-200 dark:border-amber-800 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-800/30 rounded-full">
            <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {!isOnline ? "You're offline" : "Unable to reach Inkog API"}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {offlineSince
                ? `Disconnected ${formatOfflineDuration(offlineSince)}`
                : "Some features may be unavailable"}
            </p>
          </div>
        </div>

        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-800/30 rounded-md hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Checking...' : 'Retry'}
        </button>
      </div>
    </div>
  );
}

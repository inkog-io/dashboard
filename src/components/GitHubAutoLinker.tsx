"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { createAPIClient } from "@/lib/api";

const PENDING_INSTALLATION_KEY = "pending_github_installation";

/**
 * Checks localStorage for a pending GitHub installation and links it to the current user.
 * This handles the flow: install GitHub App → not signed in → store installation_id →
 * sign in later → dashboard loads → auto-link.
 */
export function GitHubAutoLinker() {
  const { getToken } = useAuth();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const pendingId = localStorage.getItem(PENDING_INSTALLATION_KEY);
    if (!pendingId) return;

    const installationId = parseInt(pendingId, 10);
    if (isNaN(installationId) || installationId <= 0) {
      localStorage.removeItem(PENDING_INSTALLATION_KEY);
      return;
    }

    const api = createAPIClient(getToken);
    api.github
      .linkInstallation(installationId)
      .then(() => {
        localStorage.removeItem(PENDING_INSTALLATION_KEY);
      })
      .catch(() => {
        // Don't block the dashboard — linking can be retried
        localStorage.removeItem(PENDING_INSTALLATION_KEY);
      });
  }, [getToken]);

  return null;
}

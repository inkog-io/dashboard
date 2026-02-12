"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  CheckCircle2,
  GitPullRequest,
  Shield,
  BarChart3,
  ExternalLink,
  LogIn,
  Loader2,
  LinkIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createAPIClient } from "@/lib/api";

const PENDING_INSTALLATION_KEY = "pending_github_installation";

function GitHubSetupContent() {
  const searchParams = useSearchParams();
  const installationId = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action");
  const isUpdate = setupAction === "update";

  const { isSignedIn, getToken } = useAuth();

  const [linkStatus, setLinkStatus] = useState<
    "idle" | "linking" | "linked" | "error"
  >("idle");
  const [linkedAccount, setLinkedAccount] = useState<string | null>(null);
  const [backfilledScans, setBackfilledScans] = useState(0);

  // Auto-link installation when user is signed in
  useEffect(() => {
    if (!installationId) return;

    if (isSignedIn) {
      // User is signed in — link the installation
      setLinkStatus("linking");
      const api = createAPIClient(getToken);
      api.github
        .linkInstallation(parseInt(installationId, 10))
        .then((res) => {
          setLinkStatus("linked");
          setLinkedAccount(res.installation.account);
          setBackfilledScans(res.backfilled_scans);
          // Clear any pending installation from localStorage
          localStorage.removeItem(PENDING_INSTALLATION_KEY);
        })
        .catch((err) => {
          console.error("Failed to link installation:", err);
          setLinkStatus("error");
        });
    } else {
      // Not signed in — store for later linking
      localStorage.setItem(PENDING_INSTALLATION_KEY, installationId);
    }
  }, [installationId, isSignedIn, getToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-lg w-full space-y-8 text-center">
        {/* Success icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {isUpdate ? "Settings Updated" : "Installation Complete"}
          </h1>
          <p className="mt-3 text-gray-600 dark:text-gray-400">
            {isUpdate
              ? "Your Inkog Scanner configuration has been updated."
              : "Inkog Scanner is now active on your repositories. Every pull request will be automatically scanned for security vulnerabilities."}
          </p>
        </div>

        {/* Link status banner */}
        {linkStatus === "linking" && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Linking to your account...
          </div>
        )}
        {linkStatus === "linked" && (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
            <div className="flex items-center justify-center gap-2 text-sm text-green-700 dark:text-green-300">
              <LinkIcon className="w-4 h-4" />
              Linked to your account{linkedAccount ? ` (${linkedAccount})` : ""}
            </div>
            {backfilledScans > 0 && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {backfilledScans} existing scan{backfilledScans !== 1 ? "s" : ""} added to your dashboard
              </p>
            )}
          </div>
        )}
        {linkStatus === "error" && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Could not link to your account automatically. You can link it from the dashboard later.
            </p>
          </div>
        )}

        {/* Sign in prompt for unauthenticated users */}
        {!isSignedIn && installationId && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              Sign in to link this installation to your dashboard and view scan history.
            </p>
            <Link href="/sign-in">
              <Button variant="outline" size="sm">
                <LogIn className="w-4 h-4 mr-2" />
                Sign in to link
              </Button>
            </Link>
          </div>
        )}

        {/* What happens next */}
        <div className="space-y-3 text-left">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">
            What happens next
          </p>

          <Card>
            <CardContent className="flex gap-4 py-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <GitPullRequest className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Open a Pull Request
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Push a branch and open a PR. Inkog will automatically run a
                  security scan and post results as a check run and PR comment.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex gap-4 py-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Review Findings
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  If issues are found, they appear inline on the PR with
                  severity, file location, and remediation guidance.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex gap-4 py-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Track in Dashboard
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  View scan history, trends, and compliance reports across all
                  your repositories.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard">
            <Button size="lg" className="w-full sm:w-auto">
              <BarChart3 className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Button>
          </Link>
          <a
            href="https://docs.inkog.io/integrations/github-app"
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Documentation
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </a>
        </div>

        {/* Installation ID */}
        {installationId && (
          <p className="text-xs text-gray-400">
            Installation ID: {installationId}
          </p>
        )}
      </div>
    </div>
  );
}

export default function GitHubSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>
      }
    >
      <GitHubSetupContent />
    </Suspense>
  );
}

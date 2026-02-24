"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Key, BarChart3, Settings2, GitBranch } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { TerminalProgressUI } from "@/components/TerminalProgressUI";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  trackAnonymousScanStarted,
  trackAnonymousScanCompleted,
} from "@/lib/analytics-public";
import type { PublicScanResponse, PublicScanError } from "@/lib/scan-public-types";

const EXAMPLE_REPOS = [
  "https://github.com/OpenBMB/ChatDev",
  "https://github.com/geekan/MetaGPT",
];

export default function PublicScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();
  const [repoUrl, setRepoUrl] = useState(searchParams.get("url") || "");
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanDone, setScanDone] = useState(false);
  const scanUrlRef = useRef<string>("");

  // Redirect signed-in users to the full dashboard scanner
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const url = searchParams.get("url");
      router.replace(url ? `/dashboard/scan?url=${encodeURIComponent(url)}` : "/dashboard/scan");
    }
  }, [isLoaded, isSignedIn, router, searchParams]);

  // Auto-scan if ?url= is pre-filled (e.g., from "Scan again" link)
  const hasAutoScanned = useRef(false);
  const autoScanUrl = searchParams.get("url");

  const handleScan = useCallback(
    async (urlOverride?: string) => {
      const url = urlOverride || repoUrl;
      if (!url.trim() || isScanning) return;

      if (urlOverride) setRepoUrl(urlOverride);
      scanUrlRef.current = url.trim();

      setError(null);
      setIsScanning(true);
      setScanDone(false);

      const startTime = Date.now();
      trackAnonymousScanStarted({ repo_url: url });

      try {
        const res = await fetch("/api/scan-public", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo_url: url.trim() }),
        });

        const data = await res.json();

        if (!res.ok) {
          const err = data as PublicScanError;
          if (err.code === "rate_limited") {
            setError("Too many scans. Please wait an hour and try again.");
          } else if (err.code === "clone_failed") {
            setError(
              "Repository not found or is private. Only public GitHub repos are supported."
            );
          } else if (err.code === "invalid_url") {
            setError(err.error);
          } else if (err.code === "repo_too_large" || res.status === 502) {
            setError(
              "too_large"
            );
          } else {
            setError("Scan failed. Please try again.");
          }
          setIsScanning(false);
          return;
        }

        const result = data as PublicScanResponse;

        trackAnonymousScanCompleted({
          repo_url: url,
          report_id: result.report_id,
          findings_count: result.scan_result.findings_count,
          critical_count: result.scan_result.critical_count,
          duration_ms: Date.now() - startTime,
        });

        // Signal terminal to fast-forward, then navigate
        setScanDone(true);
        setTimeout(() => {
          router.push(`/report/${result.report_id}`);
        }, 1200);
      } catch {
        setError("Network error. Please check your connection and try again.");
        setIsScanning(false);
      }
    },
    [repoUrl, isScanning, router]
  );

  useEffect(() => {
    if (autoScanUrl && !hasAutoScanned.current) {
      hasAutoScanned.current = true;
      // Small delay to let the page render first
      const t = setTimeout(() => handleScan(autoScanUrl), 100);
      return () => clearTimeout(t);
    }
  }, [autoScanUrl, handleScan]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-16">
        {!isScanning ? (
          <div className="w-full max-w-xl text-center">
            {/* Hero */}
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand/10 mb-6">
                <Image
                  src="/favicon.svg"
                  alt="Inkog"
                  width={32}
                  height={32}
                  className="w-8 h-8"
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                Scan your AI agent for vulnerabilities
              </h1>
              <p className="text-muted-foreground text-base sm:text-lg">
                Zero setup. Results in 60 seconds. Paste a public GitHub repo
                URL to get a free security report.
              </p>
            </div>

            {/* Input */}
            <div className="flex gap-2 sm:gap-3">
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                placeholder="https://github.com/owner/repo"
                className="flex-1 min-w-0 h-12 px-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-sm"
                autoFocus
              />
              <Button
                onClick={() => handleScan()}
                disabled={!repoUrl.trim()}
                size="lg"
                className="h-12 px-6 shrink-0"
              >
                Scan
              </Button>
            </div>

            {/* Error with recovery */}
            {error && error !== "too_large" && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            {/* Special error for too-large repos with example suggestions */}
            {error === "too_large" && (
              <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-left">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                  This repo is too large for browser scanning.
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                  Create a free account to scan unlimited repos via CLI, or try
                  a smaller example:
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_REPOS.map((url) => (
                    <button
                      key={url}
                      onClick={() => handleScan(url)}
                      className="px-3 py-1.5 rounded-md bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-xs font-mono border border-amber-200 dark:border-amber-700 transition-colors text-foreground"
                    >
                      {url.replace("https://github.com/", "")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Example repos — click to auto-scan */}
            {!error && (
              <div className="mt-8 text-sm text-muted-foreground">
                <p className="mb-2">Try an example:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLE_REPOS.map((url) => (
                    <button
                      key={url}
                      onClick={() => handleScan(url)}
                      className="px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-xs font-mono transition-colors"
                    >
                      {url.replace("https://github.com/", "")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Account benefits */}
            <div className="mt-12 pt-8 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Create a free account to unlock
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50">
                  <Key className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">API Keys & CLI</p>
                    <p className="text-xs text-muted-foreground">Scan private repos with no size limits</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50">
                  <BarChart3 className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Full Reports</p>
                    <p className="text-xs text-muted-foreground">Governance scores, compliance mapping, topology</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50">
                  <Settings2 className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Scan Policies</p>
                    <p className="text-xs text-muted-foreground">EU AI Act, governance, low-noise & more</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/50">
                  <GitBranch className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">GitHub Integration</p>
                    <p className="text-xs text-muted-foreground">Auto-scan on every push, PR comments</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl px-0 sm:px-0">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Scanning repository...
              </h2>
              <p className="text-sm text-muted-foreground">
                This usually takes 30–90 seconds depending on repo size.
              </p>
            </div>
            <TerminalProgressUI
              isActive={isScanning}
              repoName={scanUrlRef.current.replace("https://github.com/", "")}
              fastForward={scanDone}
            />
          </div>
        )}
      </main>
    </div>
  );
}

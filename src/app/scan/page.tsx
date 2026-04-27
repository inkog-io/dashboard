"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Terminal, BarChart3, Settings2, GitBranch } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { TerminalProgressUI } from "@/components/TerminalProgressUI";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  trackAnonymousScanStarted,
  trackAnonymousScanCompleted,
  trackAnonymousScanError,
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

      const MAX_RETRIES = 2;
      const TIMEOUT_MS = 200_000;
      let lastError = "";
      let lastErrorCode = "";

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          const res = await fetch("/api/scan-public", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repo_url: url.trim() }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const data = await res.json();

          if (!res.ok) {
            const err = data as PublicScanError;

            if (res.status >= 400 && res.status < 500) {
              if (err.code === "rate_limited") {
                setError("Too many scans. Please wait an hour and try again.");
              } else if (err.code === "clone_failed") {
                setError(
                  "Repository not found or is private. Only public GitHub repos are supported."
                );
              } else if (err.code === "invalid_url") {
                setError(err.error);
              } else if (err.code === "repo_too_large") {
                setError("too_large");
              } else {
                setError("Scan failed. Please try again.");
              }
              setIsScanning(false);
              return;
            }

            if (res.status === 502) {
              setError("too_large");
              setIsScanning(false);
              return;
            }

            lastError = err.error || "Server error";
            lastErrorCode = err.code || `http_${res.status}`;

            if (attempt < MAX_RETRIES) {
              const backoff = (attempt + 1) * 3000;
              await new Promise((r) => setTimeout(r, backoff));
              continue;
            }
            break;
          }

          const result = data as PublicScanResponse;

          trackAnonymousScanCompleted({
            repo_url: url,
            report_id: result.report_id,
            findings_count: result.scan_result.findings_count,
            critical_count: result.scan_result.critical_count,
            duration_ms: Date.now() - startTime,
          });

          setScanDone(true);
          setTimeout(() => {
            router.push(`/report/${result.report_id}`);
          }, 1200);
          return;
        } catch (e) {
          clearTimeout(timeoutId);

          const isAbort = e instanceof DOMException && e.name === "AbortError";
          lastError = isAbort ? "Request timed out" : "Network error";
          lastErrorCode = isAbort ? "timeout" : "network_error";

          if (attempt < MAX_RETRIES) {
            const backoff = (attempt + 1) * 3000;
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
        }
      }

      trackAnonymousScanError({
        repo_url: url,
        error_code: lastErrorCode,
        error_message: lastError,
        duration_ms: Date.now() - startTime,
        retry_count: MAX_RETRIES,
      });

      setError(
        lastErrorCode === "timeout"
          ? "The scan timed out. The repository may be very large — try again or create a free account to scan via CLI."
          : "Scan failed after multiple attempts. Please try again later."
      );
      setIsScanning(false);
    },
    [repoUrl, isScanning, router]
  );

  useEffect(() => {
    if (autoScanUrl && !hasAutoScanned.current) {
      hasAutoScanned.current = true;
      const t = setTimeout(() => handleScan(autoScanUrl), 100);
      return () => clearTimeout(t);
    }
  }, [autoScanUrl, handleScan]);

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-16 sm:py-24">
        {!isScanning ? (
          <div className="w-full max-w-lg text-center">
            {/* Hero */}
            <div className="mb-10">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand/10 mb-6">
                <Image
                  src="/favicon.svg"
                  alt="Inkog"
                  width={28}
                  height={28}
                  className="w-7 h-7"
                />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">
                Scan your AI agent
              </h1>
              <p className="text-lg text-muted-foreground">
                Paste a public GitHub repo URL. Get a security report in 60 seconds.
              </p>
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                placeholder="https://github.com/owner/repo"
                className="flex-1 min-w-0 h-14 px-5 rounded-xl border-2 border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-base transition-colors"
                autoFocus
              />
              <Button
                onClick={() => handleScan()}
                disabled={!repoUrl.trim()}
                className="h-14 px-8 rounded-xl text-base font-semibold shrink-0 hover:shadow-[0_0_20px_hsl(239_84%_67%/0.3)] transition-shadow"
              >
                Scan
              </Button>
            </div>

            {/* Scan tier note */}
            <p className="mt-3 text-xs text-muted-foreground/50">
              Powered by Inkog Core + Deep &middot; AI behavioral analysis included
            </p>

            {/* Error with recovery */}
            {error && error !== "too_large" && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            {/* Special error for too-large repos */}
            {error === "too_large" && (
              <div className="mt-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-left">
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
                      className="px-4 py-2 rounded-full bg-card hover:bg-brand/10 hover:text-brand text-xs font-mono border border-amber-200 dark:border-amber-700 transition-colors text-foreground"
                    >
                      {url.replace("https://github.com/", "")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Example repos */}
            {!error && (
              <div className="mt-8 text-sm text-muted-foreground">
                <p className="mb-3">Try an example:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLE_REPOS.map((url) => (
                    <button
                      key={url}
                      onClick={() => handleScan(url)}
                      className="px-4 py-2 rounded-full bg-muted hover:bg-brand/10 hover:text-brand text-sm font-mono transition-all duration-200"
                    >
                      {url.replace("https://github.com/", "")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Benefits strip */}
            <div className="mt-16 pt-6 border-t border-border">
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground/50">
                <span className="inline-flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  CLI & API
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  Full Reports
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5" />
                  Scan Policies
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" />
                  GitHub Integration
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            <div className="text-center mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Scanning repository...
              </h2>
              <p className="text-sm text-muted-foreground">
                Core analysis in progress. Deep behavioral analysis will continue in background.
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
    </ErrorBoundary>
  );
}

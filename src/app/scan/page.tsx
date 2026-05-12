"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Terminal, Shield, Settings2, GitBranch, X } from "lucide-react";
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

const PENDING_SCAN_KEY = "inkog_pending_scan";
const PENDING_TTL_MS = 5 * 60 * 1000;

type PendingScan = {
  repo_url: string;
  started_at: number;
};

function readPendingScan(): PendingScan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_SCAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingScan;
    if (Date.now() - parsed.started_at > PENDING_TTL_MS) {
      window.localStorage.removeItem(PENDING_SCAN_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePendingScan(repo_url: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PENDING_SCAN_KEY,
      JSON.stringify({ repo_url, started_at: Date.now() })
    );
  } catch {}
}

function clearPendingScan() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_SCAN_KEY);
  } catch {}
}

export default function PublicScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();
  const [repoUrl, setRepoUrl] = useState(searchParams.get("url") || "");
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanDone, setScanDone] = useState(false);
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [pendingScan, setPendingScan] = useState<PendingScan | null>(null);
  const [showCached, setShowCached] = useState(false);
  const scanUrlRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef<boolean>(false);
  const successRedirectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  // Monotonic counter incremented on every handleScan call. A long-running loop
  // captures its generation locally and aborts if a newer scan supersedes it —
  // closes the cross-scan race where a stale retry from scan A overwrites scan B.
  const scanGenRef = useRef<number>(0);

  // Redirect signed-in users to the full dashboard scanner
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const url = searchParams.get("url");
      router.replace(url ? `/dashboard/scan?url=${encodeURIComponent(url)}` : "/dashboard/scan");
    }
  }, [isLoaded, isSignedIn, router, searchParams]);

  // Fetch scan count for social proof
  useEffect(() => {
    fetch("/api/scan-count")
      .then((r) => r.json())
      .then((d) => { if (d.count > 0) setScanCount(d.count); })
      .catch(() => {});
  }, []);

  // Recover any pending scan from a previous tab/session
  useEffect(() => {
    const pending = readPendingScan();
    if (pending) setPendingScan(pending);
  }, []);

  // Clear any pending success-redirect timer on unmount so navigation
  // away during the 600–1200ms hand-off doesn't yank the user back.
  useEffect(() => {
    return () => {
      if (successRedirectRef.current) {
        clearTimeout(successRedirectRef.current);
        successRedirectRef.current = null;
      }
    };
  }, []);

  // Track elapsed time during scan (for visible progress)
  useEffect(() => {
    if (!isScanning) {
      setElapsedSec(0);
      return;
    }
    const startedAt = Date.now();
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isScanning]);

  // Auto-scan if ?url= is pre-filled (e.g., from "Scan again" link)
  const hasAutoScanned = useRef(false);
  const autoScanUrl = searchParams.get("url");

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    if (successRedirectRef.current) {
      clearTimeout(successRedirectRef.current);
      successRedirectRef.current = null;
    }
    // Close the funnel: a user cancel is a terminal event, not a tab-close.
    // Without this, a started event would have no matching terminal event in
    // PostHog and look indistinguishable from a silent drop.
    if (scanUrlRef.current) {
      trackAnonymousScanError({
        repo_url: scanUrlRef.current,
        error_code: "user_cancelled",
        error_message: "User cancelled scan",
        duration_ms: startTimeRef.current ? Date.now() - startTimeRef.current : 0,
        retry_count: 0,
      });
    }
    clearPendingScan();
    setPendingScan(null);
    setIsScanning(false);
    setScanDone(false);
    setError(null);
  }, []);

  const handleScan = useCallback(
    async (urlOverride?: string, options: { force?: boolean } = {}) => {
      const url = urlOverride || repoUrl;
      if (!url.trim() || isScanning) return;

      // If a recent scan of the same URL is already pending, don't double-fire —
      // unless the caller explicitly forced (Try-again button, explicit deeplink).
      // The recovery banner alone communicates the state — no error toast needed.
      if (!options.force) {
        const existing = readPendingScan();
        if (existing && existing.repo_url === url.trim()) {
          setPendingScan(existing);
          return;
        }
      }

      // Generation token for this scan attempt — a stale retry loop from a
      // superseded scan will see myGen !== scanGenRef.current and exit.
      scanGenRef.current += 1;
      const myGen = scanGenRef.current;

      if (urlOverride) setRepoUrl(urlOverride);
      scanUrlRef.current = url.trim();
      writePendingScan(url.trim());
      setPendingScan({ repo_url: url.trim(), started_at: Date.now() });

      setError(null);
      setShowCached(false);
      setIsScanning(true);
      setScanDone(false);
      cancelledRef.current = false;

      const startTime = Date.now();
      startTimeRef.current = startTime;
      trackAnonymousScanStarted({ repo_url: url });

      const MAX_RETRIES = 2;
      const TIMEOUT_MS = 180_000;
      let lastError = "";
      let lastErrorCode = "";

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        abortRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          const res = await fetch("/api/scan-public", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ repo_url: url.trim() }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          abortRef.current = null;

          const data = await res.json();

          if (!res.ok) {
            const err = data as PublicScanError;

            if (res.status >= 400 && res.status < 500) {
              trackAnonymousScanError({
                repo_url: url,
                error_code: err.code || `http_${res.status}`,
                error_message: err.error || "Client error",
                duration_ms: Date.now() - startTime,
                retry_count: 0,
              });
              clearPendingScan();
              setPendingScan(null);
              if (err.code === "rate_limited") {
                setError("Too many scans from your network. Please wait an hour or sign up for unlimited CLI scans.");
              } else if (err.code === "clone_failed") {
                setError(
                  "We couldn't clone that repo. It may be private, archived, or the URL might have a typo. Only public GitHub repos are supported."
                );
              } else if (err.code === "invalid_url") {
                setError(err.error || "That URL doesn't look like a GitHub repo. Use the form: https://github.com/owner/repo");
              } else if (err.code === "repo_too_large") {
                setError("too_large");
              } else if (err.code === "no_agent_code") {
                setError("no_agent_code");
              } else if (err.code === "scan_failed") {
                setError(
                  "We cloned the repo but couldn't find scannable agent code. If you're sure this is an agent project, please contact us or try the CLI for full coverage."
                );
              } else {
                setError("That request didn't go through. Double-check the URL or try a different repo.");
              }
              setIsScanning(false);
              return;
            }

            if (res.status === 502) {
              // Backend may return 502 with either repo_too_large (upstream
              // timeout) or scan_failed (worker crash, deploy roll). Branch on
              // the code so transient failures aren't misrepresented as size.
              trackAnonymousScanError({
                repo_url: url,
                error_code: err.code || "scan_failed",
                error_message: err.error || "Backend error",
                duration_ms: Date.now() - startTime,
                retry_count: attempt,
              });
              clearPendingScan();
              setPendingScan(null);
              if (err.code === "repo_too_large" || !err.code) {
                setError("too_large");
              } else if (err.code === "scan_failed") {
                setError(
                  "Something flaked on our end while running this scan. Try again in a minute — if it persists, email hello@inkog.io with the repo URL."
                );
              } else {
                setError("Scan failed. Please try again in a minute.");
              }
              setIsScanning(false);
              return;
            }

            lastError = err.error || "Server error";
            lastErrorCode = err.code || `http_${res.status}`;

            if (attempt < MAX_RETRIES) {
              const backoff = (attempt + 1) * 3000;
              await new Promise((r) => setTimeout(r, backoff));
              if (cancelledRef.current || myGen !== scanGenRef.current) return;
              continue;
            }
            break;
          }

          // Cancel-during-res.json() race: abortRef was nulled before json
          // resolved, so handleCancel couldn't abort us. Check refs here.
          if (cancelledRef.current || myGen !== scanGenRef.current) return;

          const result = data as PublicScanResponse;

          trackAnonymousScanCompleted({
            repo_url: url,
            report_id: result.report_id,
            findings_count: result.scan_result.findings_count,
            critical_count: result.scan_result.critical_count,
            duration_ms: Date.now() - startTime,
          });

          clearPendingScan();
          setPendingScan(null);
          setScanDone(true);
          if (result.cached) setShowCached(true);
          successRedirectRef.current = setTimeout(
            () => {
              successRedirectRef.current = null;
              router.push(`/report/${result.report_id}`);
            },
            result.cached ? 600 : 1200
          );
          return;
        } catch (e) {
          clearTimeout(timeoutId);
          abortRef.current = null;

          const isAbort = e instanceof DOMException && e.name === "AbortError";
          // User-initiated cancel exits the loop without firing the generic error path
          if (isAbort && cancelledRef.current) return;
          // A newer scan has superseded us — bail without touching state
          if (myGen !== scanGenRef.current) return;

          lastError = isAbort ? "Request timed out" : "Network error";
          lastErrorCode = isAbort ? "timeout" : "network_error";

          if (attempt < MAX_RETRIES) {
            const backoff = (attempt + 1) * 3000;
            await new Promise((r) => setTimeout(r, backoff));
            if (cancelledRef.current || myGen !== scanGenRef.current) return;
            continue;
          }
        }
      }

      // Last guard before terminal error handling — same-purpose check.
      if (myGen !== scanGenRef.current) return;

      trackAnonymousScanError({
        repo_url: url,
        error_code: lastErrorCode,
        error_message: lastError,
        duration_ms: Date.now() - startTime,
        retry_count: MAX_RETRIES,
      });

      clearPendingScan();
      setPendingScan(null);

      setError(
        lastErrorCode === "timeout"
          ? "The scan took longer than 3 minutes. That usually means the repo is very large — try a smaller agent example below, or sign up for the CLI which has no time limit."
          : "Something went wrong on our end after two retries. This is on us — please try again in a few minutes or email hello@inkog.io if it keeps happening."
      );
      setIsScanning(false);
    },
    [repoUrl, isScanning, router]
  );

  useEffect(() => {
    // Don't auto-scan while auth state is loading, or for signed-in users
    // who are about to be redirected to /dashboard/scan.
    if (!isLoaded || isSignedIn) return;
    if (autoScanUrl && !hasAutoScanned.current) {
      hasAutoScanned.current = true;
      const t = setTimeout(() => handleScan(autoScanUrl, { force: true }), 100);
      return () => clearTimeout(t);
    }
  }, [autoScanUrl, handleScan, isLoaded, isSignedIn]);

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

            {/* Recover an in-progress scan from a previous tab/session.
                Renders alongside any non-info-card error so the duplicate-scan
                detection path still shows the recovery buttons. */}
            {pendingScan && error !== "too_large" && error !== "no_agent_code" && (
              <div className="mt-4 p-4 rounded-xl bg-brand/5 border border-brand/30 text-left">
                <p className="text-sm font-medium text-foreground mb-1">
                  Looks like you started a scan a moment ago
                </p>
                <p className="text-sm text-muted-foreground mb-3 font-mono break-all">
                  {pendingScan.repo_url}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleScan(pendingScan.repo_url, { force: true })}
                    className="px-4 py-2 rounded-full bg-brand text-brand-foreground hover:opacity-90 text-xs font-medium transition-opacity"
                  >
                    Try again
                  </button>
                  <button
                    onClick={() => {
                      clearPendingScan();
                      setPendingScan(null);
                      setError(null);
                    }}
                    className="px-4 py-2 rounded-full bg-muted hover:bg-muted/70 text-xs font-medium transition-colors"
                  >
                    Start fresh
                  </button>
                </div>
              </div>
            )}

            {/* Error with recovery */}
            {error && error !== "too_large" && error !== "no_agent_code" && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            {/* Not an agent repo — informational, not an error.
                Backend filtered out every uploaded file (docs-only, jsonnet,
                binary, etc.), so we tell the user what we actually scan and
                offer a working example. No red text — this isn't a failure. */}
            {error === "no_agent_code" && (
              <div className="mt-4 p-4 rounded-xl bg-brand/5 dark:bg-brand/10 border border-brand/30 text-left">
                <p className="text-sm font-medium text-foreground mb-2">
                  This doesn&apos;t look like an AI agent project
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  Inkog scans code that uses LLMs and agent frameworks
                  (LangChain, CrewAI, AutoGen, ADK, Pydantic AI, custom). We
                  couldn&apos;t find any of that in this repo.
                </p>
                <p className="text-sm text-muted-foreground mb-3">
                  Try a real agent example:
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_REPOS.map((url) => (
                    <button
                      key={url}
                      onClick={() => handleScan(url)}
                      className="px-4 py-2 rounded-full bg-card hover:bg-brand/10 hover:text-brand text-xs font-mono border border-brand/30 transition-colors text-foreground"
                    >
                      {url.replace("https://github.com/", "")}
                    </button>
                  ))}
                </div>
              </div>
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
                  <Shield className="w-3.5 h-3.5" />
                  {scanCount !== null
                    ? `${new Intl.NumberFormat().format(scanCount)} agents scanned`
                    : "--- agents scanned"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  CLI & API
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
                {showCached
                  ? "Already scanned recently — opening cached report"
                  : "Scanning repository..."}
              </h2>
              <p className="text-sm text-muted-foreground">
                {showCached
                  ? "Loading your previous report…"
                  : elapsedSec > 60
                    ? `Still working (${elapsedSec}s) — large repos can take up to 3 minutes.`
                    : elapsedSec > 0
                      ? `Core analysis in progress · ${elapsedSec}s elapsed`
                      : "Core analysis in progress. Deep behavioral analysis runs after."}
              </p>
              {!scanDone && (
                <button
                  onClick={handleCancel}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
              )}
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

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

export default function PublicScanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [repoUrl, setRepoUrl] = useState(searchParams.get("url") || "");
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanDone, setScanDone] = useState(false);

  async function handleScan() {
    if (!repoUrl.trim() || isScanning) return;

    setError(null);
    setIsScanning(true);
    setScanDone(false);

    const startTime = Date.now();
    trackAnonymousScanStarted({ repo_url: repoUrl });

    try {
      const res = await fetch("/api/scan-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_url: repoUrl.trim() }),
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
        } else if (err.code === "repo_too_large") {
          setError(
            "This repository is too large for browser scanning. Create a free account to scan via CLI with no size limits."
          );
        } else if (res.status === 502) {
          setError(
            "Scan timed out — the repository may be too large. Try a smaller repo, or use the CLI for unlimited scanning."
          );
        } else {
          setError("Scan failed. Please try again.");
        }
        setIsScanning(false);
        return;
      }

      const result = data as PublicScanResponse;

      trackAnonymousScanCompleted({
        repo_url: repoUrl,
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
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
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
              <h1 className="text-3xl font-bold text-foreground mb-3">
                Scan your AI agent for vulnerabilities
              </h1>
              <p className="text-muted-foreground text-lg">
                Zero setup. Results in 60 seconds. Paste a public GitHub repo
                URL to get a free security report.
              </p>
            </div>

            {/* Input */}
            <div className="flex gap-3">
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                placeholder="https://github.com/owner/repo"
                className="flex-1 h-12 px-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-sm"
                autoFocus
              />
              <Button
                onClick={handleScan}
                disabled={!repoUrl.trim()}
                size="lg"
                className="h-12 px-6"
              >
                Scan
              </Button>
            </div>

            {/* Error */}
            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            {/* Example repos */}
            <div className="mt-8 text-sm text-muted-foreground">
              <p className="mb-2">Try an example:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "https://github.com/OpenBMB/ChatDev",
                  "https://github.com/crewAIInc/crewAI-examples",
                ].map((url) => (
                  <button
                    key={url}
                    onClick={() => setRepoUrl(url)}
                    className="px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-xs font-mono transition-colors"
                  >
                    {url.replace("https://github.com/", "")}
                  </button>
                ))}
              </div>
            </div>

            {/* Account benefits */}
            <div className="mt-12 pt-8 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Create a free account to unlock
              </p>
              <div className="grid grid-cols-2 gap-3 text-left">
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
          <div className="w-full max-w-2xl">
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
              repoName={repoUrl.replace("https://github.com/", "")}
              fastForward={scanDone}
            />
          </div>
        )}
      </main>
    </div>
  );
}

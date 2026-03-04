"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  Upload,
  Bot,
  Loader2,
  AlertCircle,
  FileArchive,
  X,
  ArrowLeft,
  History,
} from "lucide-react";
import Link from "next/link";

import { createAPIClient, InkogAPIError, type InkogAPI } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { addPendingDeepScan, removePendingDeepScan } from "@/lib/pending-deep-scans";

type DeepScanStatus = "idle" | "uploading" | "processing" | "completed" | "failed";

export default function DeepChecksPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const { canAccessDeepScan, isLoading: userLoading } = useCurrentUser();

  const [api, setApi] = useState<InkogAPI | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [agentName, setAgentName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<DeepScanStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setApi(createAPIClient(getToken));
  }, [getToken]);

  // Redirect non-admins
  useEffect(() => {
    if (!userLoading && !canAccessDeepScan) {
      router.push("/dashboard");
    }
  }, [canAccessDeepScan, userLoading, router]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".zip") || droppedFile.type === "application/zip")) {
      setFile(droppedFile);
      if (!agentName) {
        setAgentName(droppedFile.name.replace(/\.zip$/i, ""));
      }
    } else {
      setError("Please upload a .zip file");
    }
  }, [agentName]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!agentName) {
        setAgentName(selected.name.replace(/\.zip$/i, ""));
      }
      setError(null);
    }
  }, [agentName]);

  const pollStatus = useCallback(async (id: string) => {
    if (!api) return;
    try {
      const data = await api.deepScan.getStatus(id);
      if (data.status === "completed") {
        if (pollRef.current) clearInterval(pollRef.current);
        removePendingDeepScan(id);
        // Redirect to the polished results page
        router.push(`/dashboard/results/${id}`);
      } else if (data.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        removePendingDeepScan(id);
        setStatus("failed");
        setError("Deep analysis failed. Please try again.");
      }
    } catch (err) {
      // Don't stop polling on transient errors
      console.error("Poll error:", err);
    }
  }, [api, router]);

  const startScan = useCallback(async () => {
    if (!api || !file) return;
    setStatus("uploading");
    setError(null);

    try {
      const data = await api.deepScan.trigger(file, agentName || "Security Scan");
      const resolvedName = agentName || "Security Scan";
      setScanId(data.scan_id);
      setStatus("processing");
      addPendingDeepScan({
        scanId: data.scan_id,
        agentName: resolvedName,
        startedAt: new Date().toISOString(),
      });

      // Start polling
      pollRef.current = setInterval(() => {
        pollStatus(data.scan_id);
      }, 5000); // Poll every 5 seconds
    } catch (err) {
      setStatus("failed");
      if (err instanceof InkogAPIError) {
        setError(err.message);
      } else {
        setError("Failed to start deep scan");
      }
    }
  }, [api, file, agentName, pollStatus]);

  const resetScan = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setFile(null);
    setAgentName("");
    setStatus("idle");
    setError(null);
    setScanId(null);
  }, []);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canAccessDeepScan) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/scan"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Inkog Deep Checks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload a repository archive for deep security analysis
          </p>
        </div>
      </div>

      {/* Upload Section */}
      {status === "idle" && (
        <div className="space-y-4">
          {/* Zip Upload Area */}
          {!file ? (
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                isDragging
                  ? "border-foreground bg-muted"
                  : "border-border hover:border-muted-foreground"
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleDrop}
            >
              <FileArchive className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Drag & drop your repository .zip file here
              </p>
              <input
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="hidden"
                id="zip-upload"
              />
              <label
                htmlFor="zip-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              >
                <Upload className="h-4 w-4" />
                Choose .zip file
              </label>
              <p className="text-xs text-muted-foreground mt-3">
                Max 50MB. The entire repository folder should be zipped.
              </p>
            </div>
          ) : (
            <div className="border rounded-xl p-6 space-y-4">
              {/* Selected file */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileArchive className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button onClick={() => setFile(null)} className="p-1 hover:bg-muted rounded">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {/* Agent name */}
              <div>
                <label className="block text-sm font-medium mb-1">Agent Name</label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="e.g., Sales Outreach Agent"
                  className="w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              {/* Start Button */}
              <button
                onClick={startScan}
                className="w-full py-3 bg-foreground text-background font-medium rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
              >
                <Bot className="h-5 w-5" />
                Run Deep Security Analysis
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Processing State */}
      {(status === "uploading" || status === "processing") && (
        <div className="border rounded-xl p-12 text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">
              {status === "uploading" ? "Uploading repository..." : "Deep Analysis in Progress"}
            </h3>
            <p className="text-muted-foreground text-sm mt-1">
              {status === "uploading"
                ? "Sending your repository to the analysis server..."
                : "Inkog Deep is analyzing your code against 30+ detection rules. This can take up to 10 minutes depending on code size."}
            </p>
          </div>
          {scanId && (
            <p className="text-xs text-muted-foreground font-mono">
              Scan ID: {scanId}
            </p>
          )}
          {status === "processing" && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-sm text-muted-foreground">
              <History className="h-4 w-4" />
              <span>
                You can leave this page.{" "}
                <Link
                  href="/dashboard/history"
                  className="underline font-medium text-foreground hover:opacity-80"
                >
                  Check History
                </Link>{" "}
                to see when it&apos;s done.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Failed State */}
      {status === "failed" && (
        <div className="border border-destructive/20 rounded-xl p-8 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">Analysis Failed</h3>
            <p className="text-muted-foreground text-sm mt-1">{error || "An unknown error occurred"}</p>
          </div>
          <button
            onClick={resetScan}
            className="px-4 py-2 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Completed — redirects to results page via pollStatus */}
    </div>
  );
}

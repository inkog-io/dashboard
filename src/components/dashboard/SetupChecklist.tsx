"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Circle,
  Key,
  Github,
  Terminal,
  FileSearch,
  X,
  ChevronRight,
  Upload,
  Code,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CopyCommand } from "@/components/onboarding/CopyCommand";
import { SETUP_INSTRUCTIONS } from "@/lib/setup-instructions";

interface SetupChecklistProps {
  hasApiKey: boolean;
  hasScans: boolean;
  hasGitHub: boolean;
  latestScanId?: string;
  className?: string;
}

interface Step {
  id: string;
  label: string;
  time?: string;
  complete: boolean;
  icon: React.ElementType;
  action?: () => void;
  href?: string;
  expandable?: boolean;
}

const STORAGE_KEY_DISMISSED = "inkog_setup_dismissed";
const STORAGE_KEY_REVIEWED = "inkog_reviewed_findings";

export function SetupChecklist({
  hasApiKey,
  hasScans,
  hasGitHub,
  latestScanId,
  className,
}: SetupChecklistProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true); // default true to avoid flash
  const [reviewedFindings, setReviewedFindings] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [scanMethod, setScanMethod] = useState<"cli" | "upload" | "url">("cli");

  // Load dismissed/reviewed state from localStorage
  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY_DISMISSED) === "true");
    setReviewedFindings(localStorage.getItem(STORAGE_KEY_REVIEWED) === "true");
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY_DISMISSED, "true");
    setDismissed(true);
  }, []);

  const steps: Step[] = [
    {
      id: "account",
      label: "Create account",
      complete: true, // always complete if they're here
      icon: Check,
    },
    {
      id: "api-key",
      label: "Generate API key",
      time: "~1 min",
      complete: hasApiKey,
      icon: Key,
      href: "/dashboard/settings?tab=api-keys",
    },
    {
      id: "github",
      label: "Connect GitHub",
      time: "~3 min",
      complete: hasGitHub,
      icon: Github,
      href: "/dashboard/settings?tab=integrations",
    },
    {
      id: "first-scan",
      label: "Run first scan",
      time: "~2 min",
      complete: hasScans,
      icon: Terminal,
      expandable: true,
    },
    {
      id: "review",
      label: "Review findings",
      time: "~1 min",
      complete: reviewedFindings || (hasScans && reviewedFindings),
      icon: FileSearch,
      href: latestScanId
        ? `/dashboard/results/${latestScanId}`
        : "/dashboard/history",
    },
  ];

  const completedCount = steps.filter((s) => s.complete).length;
  const allComplete = completedCount === steps.length;

  // Don't render if dismissed or all complete
  if (dismissed || allComplete) return null;

  const progress = (completedCount / steps.length) * 100;

  // Find the first incomplete step
  const currentStepId = steps.find((s) => !s.complete)?.id;

  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl p-4 sm:p-5",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">
            Setup Progress
          </span>
          <span className="text-xs text-muted-foreground">
            {completedCount} of {steps.length}
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1"
          title="Dismiss checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-muted rounded-full mb-4">
        <div
          className="h-1 bg-severity-safe rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-1">
        {steps.map((step) => {
          const isCurrent = step.id === currentStepId;
          const isExpanded = expandedStep === step.id;
          const StepIcon = step.icon;

          return (
            <div key={step.id}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  step.complete && "opacity-60",
                  isCurrent &&
                    "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40"
                )}
              >
                {/* Status indicator */}
                {step.complete ? (
                  <div className="w-5 h-5 rounded-full bg-severity-safe flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                ) : isCurrent ? (
                  <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center flex-shrink-0">
                    <Circle className="h-2 w-2 fill-blue-500 text-blue-500" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border-[1.5px] border-muted-foreground/30 flex-shrink-0" />
                )}

                {/* Label */}
                <span
                  className={cn(
                    "text-sm flex-1",
                    step.complete
                      ? "text-muted-foreground line-through"
                      : isCurrent
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>

                {/* Time estimate */}
                {step.time && !step.complete && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {step.time}
                  </span>
                )}

                {/* Action button */}
                {!step.complete && isCurrent && (
                  <>
                    {step.expandable ? (
                      <button
                        onClick={() =>
                          setExpandedStep(isExpanded ? null : step.id)
                        }
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-0.5"
                      >
                        {isExpanded ? "Close" : "Start"}
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 transition-transform",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </button>
                    ) : step.href ? (
                      <Link
                        href={step.href}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-0.5"
                      >
                        Start
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </>
                )}
              </div>

              {/* Expanded scan instructions */}
              {isExpanded && step.id === "first-scan" && (
                <div className="ml-8 mt-2 mb-2 p-3 bg-muted/50 rounded-lg border border-border">
                  {/* Method tabs */}
                  <div className="flex gap-1 mb-3">
                    {(
                      [
                        { id: "cli", label: "CLI", icon: Terminal },
                        { id: "upload", label: "Upload", icon: Upload },
                        { id: "url", label: "GitHub URL", icon: Code },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setScanMethod(m.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                          scanMethod === m.id
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <m.icon className="h-3 w-3" />
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Method-specific instructions */}
                  {scanMethod === "cli" && (
                    <div className="space-y-2">
                      <CopyCommand
                        command={SETUP_INSTRUCTIONS.cli.install}
                        label="Install Inkog CLI"
                      />
                      <CopyCommand
                        command={SETUP_INSTRUCTIONS.cli.scan}
                        label="Scan your agent"
                      />
                    </div>
                  )}
                  {scanMethod === "upload" && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Upload your agent code directly from the browser.
                      </p>
                      <Link
                        href="/dashboard/scan"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-xs font-medium rounded-md hover:opacity-90 transition-opacity"
                      >
                        <Upload className="h-3 w-3" />
                        Go to Scan Page
                      </Link>
                    </div>
                  )}
                  {scanMethod === "url" && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Scan a skill or MCP server from a GitHub repository URL.
                      </p>
                      <Link
                        href="/dashboard/scan?mode=skill"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-xs font-medium rounded-md hover:opacity-90 transition-opacity"
                      >
                        <Code className="h-3 w-3" />
                        Scan by URL
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

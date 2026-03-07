"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Shield } from "lucide-react";

const SCAN_PHASES = [
  { id: "upload", label: "Uploading code", duration: 800 },
  { id: "parse", label: "Parsing AST", duration: 1200 },
  { id: "taint", label: "Analyzing data flow", duration: 1500 },
  { id: "patterns", label: "Detecting vulnerabilities", duration: 2000 },
  { id: "governance", label: "Checking EU AI Act compliance", duration: 1000 },
  { id: "complete", label: "Generating report", duration: 500 },
];

interface ScanProgressProps {
  isScanning: boolean;
  onComplete?: () => void;
  className?: string;
}

export function ScanProgress({ isScanning, onComplete, className }: ScanProgressProps) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [phaseProgress, setPhaseProgress] = useState(0);

  useEffect(() => {
    if (!isScanning) {
      setCurrentPhase(0);
      setPhaseProgress(0);
      return;
    }

    let phaseIndex = 0;
    let timeout: NodeJS.Timeout;

    const advancePhase = () => {
      if (phaseIndex < SCAN_PHASES.length - 1) {
        phaseIndex++;
        setCurrentPhase(phaseIndex);
        setPhaseProgress(0);

        // Animate progress within phase
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += Math.random() * 15 + 5;
          if (progress >= 100) {
            progress = 100;
            clearInterval(progressInterval);
          }
          setPhaseProgress(progress);
        }, 100);

        timeout = setTimeout(() => {
          clearInterval(progressInterval);
          advancePhase();
        }, SCAN_PHASES[phaseIndex].duration);
      } else {
        setPhaseProgress(100);
        onComplete?.();
      }
    };

    // Start first phase
    setPhaseProgress(0);
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(progressInterval);
      }
      setPhaseProgress(progress);
    }, 100);

    timeout = setTimeout(() => {
      clearInterval(progressInterval);
      advancePhase();
    }, SCAN_PHASES[0].duration);

    return () => {
      clearTimeout(timeout);
    };
  }, [isScanning, onComplete]);

  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      {/* Central shield animation */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center",
            "bg-gradient-to-br from-foreground to-foreground/70",
            "shadow-lg"
          )}>
            <Shield className="w-10 h-10 text-white" />
          </div>
          {isScanning && (
            <div className="absolute inset-0 animate-ping">
              <div className="w-20 h-20 rounded-full bg-muted-foreground opacity-30" />
            </div>
          )}
        </div>
      </div>

      {/* Phase list */}
      <div className="space-y-3">
        {SCAN_PHASES.map((phase, index) => {
          const isActive = index === currentPhase;
          const isCompleted = index < currentPhase;
          const isPending = index > currentPhase;

          return (
            <div
              key={phase.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300",
                isActive && "bg-muted",
                isCompleted && "opacity-60",
                isPending && "opacity-40"
              )}
            >
              {/* Status icon */}
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 text-foreground animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-border" />
                )}
              </div>

              {/* Label */}
              <span className={cn(
                "flex-1 text-sm",
                isActive && "font-medium text-foreground",
                isCompleted && "text-muted-foreground",
                isPending && "text-muted-foreground/60"
              )}>
                {phase.label}
              </span>

              {/* Progress indicator for active phase */}
              {isActive && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round(phaseProgress)}%
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall progress bar */}
      <div className="mt-6">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${((currentPhase + phaseProgress / 100) / SCAN_PHASES.length) * 100}%`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-center text-muted-foreground">
          {currentPhase === SCAN_PHASES.length - 1 && phaseProgress === 100
            ? "Analysis complete"
            : `Analyzing ${SCAN_PHASES[currentPhase]?.label.toLowerCase() || "code"}...`}
        </p>
      </div>
    </div>
  );
}

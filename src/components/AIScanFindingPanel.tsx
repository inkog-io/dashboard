"use client";

import { useEffect, useRef } from "react";
import { X, MapPin, Shield, AlertTriangle } from "lucide-react";
import { CodeSnippetDisplay } from "@/components/CodeSnippetDisplay";

// ---------------------------------------------------------------------------
// Types (mirrors AIScanResultsView)
// ---------------------------------------------------------------------------

export interface AIScanFinding {
  finding_number: number;
  title: string;
  detection_id: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  affected_files: { file_path: string; line_numbers: string }[];
  proof: {
    file_path: string;
    start_line: number;
    end_line: number;
    code_snippet: string;
    language: string;
  }[];
  explanation: string;
  recommended_action: string;
  false_positive_risk: string;
  false_positive_rationale: string;
  compliance_mappings: { framework: string; reference: string }[];
}

interface AIScanFindingPanelProps {
  finding: AIScanFinding | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Color maps
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; badge: string }
> = {
  CRITICAL: {
    bg: "bg-red-50 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    badge:
      "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700",
  },
  HIGH: {
    bg: "bg-orange-50 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
    badge:
      "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-700",
  },
  MEDIUM: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    badge:
      "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700",
  },
  LOW: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    badge:
      "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700",
  },
};

const CONFIDENCE_BADGE: Record<string, string> = {
  HIGH: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  MEDIUM:
    "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  LOW: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

const FP_RISK_BADGE: Record<string, string> = {
  LOW: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  MEDIUM:
    "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  HIGH: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIScanFindingPanel({ finding, onClose }: AIScanFindingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const open = finding !== null;

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) && open) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  if (!finding) return null;

  const sev = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.LOW;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-50 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-gray-900 shadow-2xl z-[60] transition-transform duration-300 ease-out overflow-hidden flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${sev.badge}`}>
              {finding.severity}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              {finding.category}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-8">
            {/* Title + detection_id */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {finding.title}
              </h2>
              <p className="text-xs font-mono text-gray-400 dark:text-gray-500">
                {finding.detection_id}
              </p>
            </div>

            {/* Explanation */}
            <div>
              <SectionLabel>Explanation</SectionLabel>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {finding.explanation}
              </p>
            </div>

            {/* Location */}
            {finding.affected_files.length > 0 && (
              <div>
                <SectionLabel>Location</SectionLabel>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    {finding.affected_files.map((af, i) => (
                      <code
                        key={i}
                        className="block text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-gray-800 dark:text-gray-200"
                      >
                        {af.file_path}:{af.line_numbers}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Evidence */}
            {finding.proof.length > 0 && (
              <div>
                <SectionLabel>Evidence</SectionLabel>
                <div className="space-y-4">
                  {finding.proof.map((p, i) => (
                    <div key={i}>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mb-1.5">
                        {p.file_path}:{p.start_line}-{p.end_line}
                      </p>
                      <CodeSnippetDisplay code={p.code_snippet} file={p.file_path} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Assessment */}
            <div className={`rounded-lg p-4 ${sev.bg} border ${sev.border}`}>
              <SectionLabel className={sev.text}>Risk Assessment</SectionLabel>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${CONFIDENCE_BADGE[finding.confidence]}`}>
                  {finding.confidence} confidence
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${
                    FP_RISK_BADGE[finding.false_positive_risk.toUpperCase()] || FP_RISK_BADGE.MEDIUM
                  }`}
                >
                  FP Risk: {finding.false_positive_risk}
                </span>
              </div>
              {finding.false_positive_rationale && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 leading-relaxed">
                  {finding.false_positive_rationale}
                </p>
              )}
            </div>

            {/* Recommended Action */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <SectionLabel className="text-green-700 dark:text-green-400">
                    Recommended Action
                  </SectionLabel>
                  <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">
                    {finding.recommended_action}
                  </p>
                </div>
              </div>
            </div>

            {/* Compliance */}
            {finding.compliance_mappings.length > 0 && (
              <div>
                <SectionLabel>Compliance</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {finding.compliance_mappings.map((cm, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800"
                    >
                      {cm.framework}: {cm.reference}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span className="font-mono">{finding.detection_id}</span>
            <span>Finding #{finding.finding_number}</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${
        className || "text-gray-500 dark:text-gray-400"
      }`}
    >
      {children}
    </p>
  );
}

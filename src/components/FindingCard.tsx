"use client";

import { ChevronRight } from "lucide-react";
import type { Finding } from "@/lib/api";

interface FindingCardProps {
  finding: Finding;
  onClick: () => void;
}

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  HIGH: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  MEDIUM: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  LOW: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
};

const tierLabels: Record<string, string> = {
  vulnerability: "Vulnerability",
  risk_pattern: "Risk Pattern",
  hardening: "Best Practice",
};

export function FindingCard({ finding, onClick }: FindingCardProps) {
  const colors = severityColors[finding.severity] || severityColors.LOW;

  // Get a short title from pattern_id (e.g., "infinite_loop" -> "Infinite Loop")
  const title = finding.pattern_id
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Get the most relevant compliance tag
  const complianceTag =
    finding.cwe ||
    finding.compliance_mapping?.eu_ai_act_articles?.[0] ||
    finding.compliance_mapping?.owasp_items?.[0] ||
    null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50/80 transition-colors duration-150 focus:outline-none focus:bg-gray-50 group"
    >
      <div className="flex items-start gap-4 min-w-0 flex-1">
        {/* Severity Badge */}
        <span
          className={`flex-shrink-0 px-2.5 py-1 text-xs font-semibold rounded-md border ${colors.bg} ${colors.text} ${colors.border}`}
        >
          {finding.severity}
        </span>

        {/* Main Content */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <h3 className="text-sm font-medium text-gray-900 truncate">
            {title}
          </h3>

          {/* File and metadata */}
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">
              {finding.file}:{finding.line}
            </code>
            {complianceTag && (
              <span className="text-gray-400">
                {complianceTag}
              </span>
            )}
            {finding.risk_tier && tierLabels[finding.risk_tier] && (
              <span className="text-gray-400">
                {tierLabels[finding.risk_tier]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight
        className="w-5 h-5 text-gray-300 group-hover:text-gray-400 flex-shrink-0 transition-colors duration-150"
      />
    </button>
  );
}

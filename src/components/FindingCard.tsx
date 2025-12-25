"use client";

import { ChevronRight, Shield, AlertTriangle } from "lucide-react";
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

const governanceCategoryLabels: Record<string, { label: string; icon: "shield" | "alert" }> = {
  oversight: { label: "Human Oversight", icon: "shield" },
  authorization: { label: "Authorization", icon: "shield" },
  audit: { label: "Audit Trail", icon: "shield" },
  privacy: { label: "Privacy", icon: "shield" },
};

/**
 * Determines if a finding is a governance violation (missing control)
 * vs a traditional vulnerability (exploitable flaw)
 */
function isGovernanceFinding(finding: Finding): boolean {
  // Use explicit finding_type if available (preferred)
  if (finding.finding_type === "governance_violation") return true;
  if (finding.finding_type === "vulnerability") return false;

  // Fallback: Has explicit governance category
  if (finding.governance_category) return true;

  // Fallback: Pattern IDs that indicate governance issues
  const governancePatterns = [
    "missing_human_oversight",
    "missing_rate_limits",
    "missing_authorization",
    "missing_audit_logging",
    "cross_tenant_data_leakage",
  ];

  return governancePatterns.some((p) => finding.pattern_id?.includes(p));
}

export function FindingCard({ finding, onClick }: FindingCardProps) {
  const colors = severityColors[finding.severity] || severityColors.LOW;
  const isGovernance = isGovernanceFinding(finding);

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

  // Get governance category label if applicable
  const governanceLabel = finding.governance_category
    ? governanceCategoryLabels[finding.governance_category]?.label
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50/80 transition-colors duration-150 focus:outline-none focus:bg-gray-50 group"
    >
      <div className="flex items-start gap-4 min-w-0 flex-1">
        {/* Type Icon - Governance vs Vulnerability */}
        <div className="flex-shrink-0 mt-0.5">
          {isGovernance ? (
            <Shield className="w-4 h-4 text-indigo-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          )}
        </div>

        {/* Severity Badge */}
        <span
          className={`flex-shrink-0 px-2.5 py-1 text-xs font-semibold rounded-md border ${colors.bg} ${colors.text} ${colors.border}`}
        >
          {finding.severity}
        </span>

        {/* Main Content */}
        <div className="min-w-0 flex-1">
          {/* Title Row */}
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {title}
            </h3>
            {/* Governance Badge */}
            {isGovernance && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
                Governance
              </span>
            )}
          </div>

          {/* File and metadata */}
          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
            <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">
              {finding.file}:{finding.line}
            </code>
            {/* Calibration indicator */}
            {finding.calibrated_confidence !== undefined && finding.calibration_reliability && (
              <span
                className={`px-1.5 py-0.5 rounded font-medium ${
                  finding.calibration_reliability === 'high' || finding.calibration_reliability === 'very_high'
                    ? 'bg-green-50 text-green-600'
                    : finding.calibration_reliability === 'moderate'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-gray-100 text-gray-500'
                }`}
                title={`Calibrated: ${Math.round(finding.calibrated_confidence * 100)}% (${finding.calibration_samples} samples)`}
              >
                {Math.round(finding.calibrated_confidence * 100)}%
              </span>
            )}
            {governanceLabel && (
              <span className="text-indigo-500 font-medium">
                {governanceLabel}
              </span>
            )}
            {complianceTag && (
              <span className="text-gray-400">
                {complianceTag}
              </span>
            )}
            {!isGovernance && finding.risk_tier && tierLabels[finding.risk_tier] && (
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

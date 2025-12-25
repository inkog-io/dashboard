"use client";

import { useEffect, useRef } from "react";
import { X, MapPin, Shield, ExternalLink, AlertTriangle, CheckCircle } from "lucide-react";
import type { Finding } from "@/lib/api";
import { CodeSnippetDisplay } from "./CodeSnippetDisplay";
import { getRemediationGuide } from "@/lib/remediationGuides";

interface FindingDetailsPanelProps {
  finding: Finding | null;
  open: boolean;
  onClose: () => void;
}

const severityColors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  CRITICAL: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: "text-red-500" },
  HIGH: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", icon: "text-orange-500" },
  MEDIUM: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "text-amber-500" },
  LOW: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "text-blue-500" },
};

const tierDescriptions: Record<string, { label: string; description: string }> = {
  vulnerability: {
    label: "Vulnerability",
    description: "Exploitable issue with proven taint flow from user input",
  },
  risk_pattern: {
    label: "Risk Pattern",
    description: "Structural issue that could become exploitable",
  },
  hardening: {
    label: "Best Practice",
    description: "Recommendation for improved security posture",
  },
};

export function FindingDetailsPanel({ finding, open, onClose }: FindingDetailsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
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

  const colors = severityColors[finding.severity] || severityColors.LOW;
  const tier = tierDescriptions[finding.risk_tier] || tierDescriptions.risk_pattern;

  // Get a title from pattern_id
  const title = finding.pattern_id
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Get remediation guide
  const remediation = getRemediationGuide(finding.pattern_id);

  // Collect compliance items
  const complianceItems: { label: string; value: string; href?: string }[] = [];
  if (finding.cwe) {
    complianceItems.push({
      label: "CWE",
      value: finding.cwe,
      href: `https://cwe.mitre.org/data/definitions/${finding.cwe.replace("CWE-", "")}.html`,
    });
  }
  if (finding.owasp_category) {
    complianceItems.push({ label: "OWASP", value: finding.owasp_category });
  }
  if (finding.compliance_mapping?.eu_ai_act_articles?.length) {
    finding.compliance_mapping.eu_ai_act_articles.forEach((article) => {
      complianceItems.push({ label: "EU AI Act", value: article });
    });
  }
  if (finding.compliance_mapping?.nist_categories?.length) {
    finding.compliance_mapping.nist_categories.forEach((cat) => {
      complianceItems.push({ label: "NIST", value: cat });
    });
  }
  if (finding.compliance_mapping?.gdpr_articles?.length) {
    finding.compliance_mapping.gdpr_articles.forEach((article) => {
      complianceItems.push({ label: "GDPR", value: article });
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out overflow-hidden flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${colors.bg} ${colors.text} ${colors.border}`}
            >
              {finding.severity}
            </span>
            {finding.cwe && (
              <span className="text-xs text-gray-500 font-mono">
                {finding.cwe}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6 space-y-8">
            {/* Title and Message */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                {title}
              </h2>
              <p className="text-gray-600 leading-relaxed">
                {finding.message}
              </p>
            </div>

            {/* Location */}
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-sm font-medium text-gray-700">Location</span>
                <code className="block mt-1 text-sm bg-gray-100 px-2 py-1 rounded font-mono text-gray-800">
                  {finding.file}:{finding.line}
                  {finding.column > 0 && `:${finding.column}`}
                </code>
              </div>
            </div>

            {/* Code Snippet */}
            {finding.code_snippet && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Code</h3>
                <CodeSnippetDisplay
                  code={finding.code_snippet}
                  file={finding.file}
                  highlightLine={finding.line}
                />
              </div>
            )}

            {/* Risk Classification */}
            <div className={`rounded-lg p-4 ${colors.bg} border ${colors.border}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 ${colors.icon} flex-shrink-0 mt-0.5`} />
                <div>
                  <h3 className="font-medium text-gray-900">{tier.label}</h3>
                  <p className="text-sm text-gray-600 mt-1">{tier.description}</p>
                  {finding.input_tainted && finding.taint_source && (
                    <p className="text-sm text-gray-600 mt-2">
                      <span className="font-medium">Taint source:</span> {finding.taint_source}
                    </p>
                  )}
                  <div className="mt-2 text-sm text-gray-500">
                    Confidence: {Math.round((finding.confidence || 0) * 100)}%
                    {finding.calibrated_confidence !== undefined && (
                      <span className="ml-2">
                        → <span className="font-medium">{Math.round(finding.calibrated_confidence * 100)}%</span>
                        <span className="ml-1 text-xs">
                          (calibrated, {finding.calibration_samples || 0} samples)
                        </span>
                      </span>
                    )}
                  </div>
                  {finding.calibration_reliability && (
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                          finding.calibration_reliability === 'high' || finding.calibration_reliability === 'very_high'
                            ? 'bg-green-100 text-green-700'
                            : finding.calibration_reliability === 'moderate'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {finding.calibration_reliability.replace('_', ' ')} reliability
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Remediation */}
            {remediation && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  How to Fix
                </h3>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <ul className="space-y-2">
                    {remediation.steps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                  {remediation.codeExample && (
                    <div className="mt-4 pt-4 border-t border-green-200">
                      <p className="text-xs text-gray-500 mb-2">Example fix:</p>
                      <pre className="text-xs bg-white/50 p-3 rounded border border-green-200 overflow-x-auto font-mono">
                        {remediation.codeExample}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Compliance Mapping */}
            {complianceItems.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Compliance & Standards
                </h3>
                <div className="flex flex-wrap gap-2">
                  {complianceItems.map((item, idx) => (
                    <div key={idx}>
                      {item.href ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-md transition-colors"
                        >
                          <span className="font-medium">{item.label}:</span>
                          <span>{item.value}</span>
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-md">
                          <span className="font-medium">{item.label}:</span>
                          <span>{item.value}</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Pattern ID: {finding.pattern_id}</span>
            <span>Finding ID: {finding.id?.slice(0, 8) || "N/A"}</span>
          </div>
        </div>
      </div>
    </>
  );
}

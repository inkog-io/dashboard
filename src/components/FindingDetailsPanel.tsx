"use client";

import { useEffect, useRef } from "react";
import { X, MapPin, Shield, ExternalLink, AlertTriangle, CheckCircle } from "lucide-react";
import type { Finding } from "@/lib/api";
import { CodeSnippetDisplay } from "./CodeSnippetDisplay";

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
    label: "Security Risk",
    description: "Structural weakness that could become exploitable under certain conditions",
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

  // Use backend-provided display fields, fall back to pattern_id
  const title = finding.display_title
    || finding.pattern_id.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const shortDesc = finding.short_description;

  // Collect compliance items
  const complianceItems: { label: string; value: string; href?: string }[] = [];
  if (finding.cwe) {
    // Split comma-separated CWEs (e.g. "CWE-15, CWE-526") into individual links
    const cweIds = finding.cwe.split(/,\s*/).filter(id => id.startsWith("CWE-"));
    cweIds.forEach((cwe) => {
      complianceItems.push({
        label: "CWE",
        value: cwe,
        href: `https://cwe.mitre.org/data/definitions/${cwe.replace("CWE-", "")}.html`,
      });
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
      {/* Backdrop - z-50 to cover Sheet overlay (z-50) */}
      <div
        className={`fixed inset-0 bg-black/20 z-50 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel - z-[60] to appear above Sheet content (z-50) */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-gray-900 shadow-2xl z-[60] transform transition-transform duration-300 ease-out overflow-hidden flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-1 text-xs font-semibold rounded-md border ${colors.bg} ${colors.text} ${colors.border}`}
            >
              {finding.severity}
            </span>
            {finding.cwe && (
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {finding.cwe}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
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
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {title}
              </h2>
              {shortDesc && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {shortDesc}
                </p>
              )}
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {finding.message}
              </p>
            </div>

            {/* Location */}
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Location</span>
                <code className="block mt-1 text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-gray-800 dark:text-gray-200">
                  {finding.file}:{finding.line}
                  {finding.column > 0 && `:${finding.column}`}
                </code>
              </div>
            </div>

            {/* Code Snippet */}
            {finding.code_snippet && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Code</h3>
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
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">{tier.label}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{tier.description}</p>
                  {finding.input_tainted && finding.taint_source && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      <span className="font-medium">Taint source:</span> {finding.taint_source}
                    </p>
                  )}
                  <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
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
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : finding.calibration_reliability === 'moderate'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {finding.calibration_reliability.replace('_', ' ')} reliability
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Explanation Trace */}
            {finding.explanation_trace && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Analysis Trace
                </h3>
                <pre className="text-xs bg-gray-950 text-green-400 p-4 rounded-lg overflow-x-auto font-mono leading-relaxed border border-gray-800">
                  {finding.explanation_trace}
                </pre>
              </div>
            )}

            {/* Remediation */}
            {(finding.remediation_steps?.length || finding.remediation_code) && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  How to Fix
                  {finding.fix_difficulty && (
                    <span className={`ml-auto px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                      finding.fix_difficulty === 'easy' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      finding.fix_difficulty === 'moderate' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {finding.fix_difficulty}
                    </span>
                  )}
                </h3>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
                  {finding.remediation_steps && finding.remediation_steps.length > 0 && (
                    <ul className="space-y-2">
                      {finding.remediation_steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {finding.remediation_code && (
                    <div className={`${finding.remediation_steps?.length ? 'mt-4 pt-4 border-t border-green-200 dark:border-green-900' : ''}`}>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Example fix:</p>
                      <pre className="text-xs bg-white/50 dark:bg-gray-900/50 p-3 rounded border border-green-200 dark:border-green-900 overflow-x-auto font-mono text-gray-800 dark:text-gray-200">
                        {finding.remediation_code}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Compliance Mapping */}
            {complianceItems.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
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
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md transition-colors"
                        >
                          <span className="font-medium">{item.label}:</span>
                          <span>{item.value}</span>
                          <ExternalLink className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded-md">
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
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Pattern ID: {finding.pattern_id}</span>
            <span>Finding ID: {finding.id?.slice(0, 8) || "N/A"}</span>
          </div>
        </div>
      </div>
    </>
  );
}

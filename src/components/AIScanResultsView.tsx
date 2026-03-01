"use client";

import { useState } from "react";
import {
  Shield,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCode,
  AlertTriangle,
  Info,
  Cpu,
  Network,
  BookOpen,
  Layers,
} from "lucide-react";
import { CodeSnippetDisplay } from "@/components/CodeSnippetDisplay";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIScanReport {
  report: {
    agent_name: string;
    date: string;
    files_audited: number;
    detection_rules_total: number;
    detection_rules_applied: number;
    total_findings: number;
    total_clean: number;
  };
  agent_profile: {
    purpose: string;
    framework: string;
    language: string;
    architecture_summary: string;
    data_sources: string[];
    data_sinks: string[];
    external_integrations: string[];
    high_risk_operations: string[];
    is_multi_agent: boolean;
    trust_boundaries: string;
  };
  severity_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    clean: number;
    na: number;
  };
  findings: AIScanFinding[];
  clean_detections: {
    detection_id: string;
    rule_name: string;
    result: string;
    reason: string;
  }[];
  compliance_summary: {
    framework: string;
    relevant_findings: number[];
  }[];
  methodology: {
    approach: string;
    cross_verification: string;
    false_positive_elimination: string;
    confidence_calibration: string;
  };
}

interface AIScanFinding {
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

export interface AIScanResultsViewProps {
  report: AIScanReport;
  scanMeta: {
    agent_name: string;
    created_at: string;
    files_scanned: number;
    findings_count: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    low_count: number;
    risk_score: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG = {
  CRITICAL: {
    bg: "bg-red-50 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    badge: "bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700",
    dot: "bg-red-500",
  },
  HIGH: {
    bg: "bg-orange-50 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-200 dark:border-orange-800",
    badge: "bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-700",
    dot: "bg-orange-500",
  },
  MEDIUM: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-800",
    badge: "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700",
    dot: "bg-amber-500",
  },
  LOW: {
    bg: "bg-blue-50 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
    badge: "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700",
    dot: "bg-blue-500",
  },
} as const;

const CONFIDENCE_BADGE = {
  HIGH: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  MEDIUM: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  LOW: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
} as const;

type SeverityKey = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

const SEVERITY_ORDER: Record<SeverityKey, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIScanResultsView({ report, scanMeta }: AIScanResultsViewProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityKey | "ALL">("ALL");
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);
  const [showCleanDetections, setShowCleanDetections] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  const filteredFindings = (
    severityFilter === "ALL"
      ? [...report.findings]
      : report.findings.filter((f) => f.severity === severityFilter)
  ).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return (
    <div className="space-y-6">
      {/* ── 1. Summary Stats ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCell label="Files Scanned" value={scanMeta.files_scanned} />
          <StatCell label="Total Findings" value={scanMeta.findings_count} />
          <StatCell label="Critical" value={scanMeta.critical_count} className="bg-red-50 dark:bg-red-900/30" valueClassName="text-red-600 dark:text-red-400" />
          <StatCell label="High" value={scanMeta.high_count} className="bg-orange-50 dark:bg-orange-900/30" valueClassName="text-orange-600 dark:text-orange-400" />
          <StatCell label="Risk Score" value={scanMeta.risk_score} className="bg-violet-50 dark:bg-violet-900/20" valueClassName="text-violet-600 dark:text-violet-400" />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span>{report.report.detection_rules_applied} / {report.report.detection_rules_total} detection rules applied</span>
          <span className="hidden sm:inline">&middot;</span>
          <span>{report.report.total_clean} clean detections</span>
        </div>
      </div>

      {/* ── 2. Agent Profile ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-violet-500" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Agent Profile</h2>
        </div>
        <div className="p-6 space-y-5">
          {/* Row 1: Framework / Language / Multi-Agent */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ProfileField label="Framework" value={report.agent_profile.framework} />
            <ProfileField label="Language" value={report.agent_profile.language} />
            <ProfileField label="Multi-Agent" value={report.agent_profile.is_multi_agent ? "Yes" : "No"} />
          </div>

          {/* Row 2: Purpose */}
          <ProfileField label="Purpose" value={report.agent_profile.purpose} />

          {/* Row 3: Architecture Summary */}
          <ProfileField label="Architecture Summary" value={report.agent_profile.architecture_summary} />

          {/* High-Risk Operations */}
          {report.agent_profile.high_risk_operations.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">High-Risk Operations</p>
              <div className="flex flex-wrap gap-2">
                {report.agent_profile.high_risk_operations.map((op, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                    <AlertTriangle className="h-3 w-3" />
                    {op}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Data Sources / Sinks / Integrations */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {report.agent_profile.data_sources.length > 0 && (
              <SubtleList label="Data Sources" items={report.agent_profile.data_sources} />
            )}
            {report.agent_profile.data_sinks.length > 0 && (
              <SubtleList label="Data Sinks" items={report.agent_profile.data_sinks} />
            )}
            {report.agent_profile.external_integrations.length > 0 && (
              <SubtleList label="Integrations" items={report.agent_profile.external_integrations} />
            )}
          </div>

          {/* Trust Boundaries */}
          {report.agent_profile.trust_boundaries && (
            <ProfileField label="Trust Boundaries" value={report.agent_profile.trust_boundaries} />
          )}
        </div>
      </div>

      {/* ── 3. Findings ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-violet-500" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              Findings
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                ({filteredFindings.length}{severityFilter !== "ALL" ? ` of ${report.findings.length}` : ""})
              </span>
            </h2>
          </div>

          {/* Severity filter pills */}
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={severityFilter === "ALL"} onClick={() => setSeverityFilter("ALL")} label="All" />
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => {
              const count = report.severity_summary[sev.toLowerCase() as keyof typeof report.severity_summary];
              if (!count) return null;
              return (
                <FilterPill
                  key={sev}
                  active={severityFilter === sev}
                  onClick={() => setSeverityFilter(sev)}
                  label={`${sev.charAt(0)}${sev.slice(1).toLowerCase()}`}
                  count={count}
                  dotColor={SEVERITY_CONFIG[sev].dot}
                />
              );
            })}
          </div>
        </div>

        {/* Finding cards */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {filteredFindings.map((finding) => (
            <FindingCard
              key={finding.finding_number}
              finding={finding}
              expanded={expandedFinding === finding.finding_number}
              onToggle={() =>
                setExpandedFinding(expandedFinding === finding.finding_number ? null : finding.finding_number)
              }
            />
          ))}
          {filteredFindings.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
              {report.findings.length === 0 ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <p>No security findings detected</p>
                </div>
              ) : (
                <p>No findings match the selected filter</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. Clean Detections ── */}
      {report.clean_detections.length > 0 && (
        <CollapsibleSection
          open={showCleanDetections}
          onToggle={() => setShowCleanDetections(!showCleanDetections)}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          title="Clean Detections"
          count={report.clean_detections.length}
        >
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {report.clean_detections.map((cd, i) => (
              <div key={i} className="px-6 py-3 flex items-start gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{cd.rule_name}</span>
                  <span className="text-gray-400 mx-1.5">&middot;</span>
                  <span className="text-gray-500 dark:text-gray-400">{cd.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ── 5. Compliance Summary ── */}
      {report.compliance_summary.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-violet-500" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Compliance Summary</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {report.compliance_summary.map((cs, i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{cs.framework}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {cs.relevant_findings.length} relevant finding{cs.relevant_findings.length !== 1 ? "s" : ""}
                  {cs.relevant_findings.length > 0 && (
                    <span className="ml-1 text-gray-400 dark:text-gray-500">
                      (#{cs.relevant_findings.join(", #")})
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 6. Methodology ── */}
      {report.methodology && (
        <CollapsibleSection
          open={showMethodology}
          onToggle={() => setShowMethodology(!showMethodology)}
          icon={<Layers className="h-4 w-4 text-violet-500" />}
          title="Methodology"
        >
          <div className="px-6 py-5 space-y-4">
            {report.methodology.approach && (
              <MethodologyField label="Approach" value={report.methodology.approach} />
            )}
            {report.methodology.cross_verification && (
              <MethodologyField label="Cross Verification" value={report.methodology.cross_verification} />
            )}
            {report.methodology.false_positive_elimination && (
              <MethodologyField label="False Positive Elimination" value={report.methodology.false_positive_elimination} />
            )}
            {report.methodology.confidence_calibration && (
              <MethodologyField label="Confidence Calibration" value={report.methodology.confidence_calibration} />
            )}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCell({ label, value, className, valueClassName }: { label: string; value: number; className?: string; valueClassName?: string }) {
  return (
    <div className={`text-center p-3 rounded-lg ${className || "bg-gray-50 dark:bg-gray-700/50"}`}>
      <p className={`text-2xl font-bold ${valueClassName || "text-gray-900 dark:text-gray-100"}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{label}</p>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-sm text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function SubtleList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">{label}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-600 flex-shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  count,
  dotColor,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  dotColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active
          ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100"
          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
      }`}
    >
      {dotColor && <span className={`h-2 w-2 rounded-full ${dotColor}`} />}
      {label}
      {count !== undefined && <span className="opacity-70">{count}</span>}
    </button>
  );
}

function CollapsibleSection({
  open,
  onToggle,
  icon,
  title,
  count,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        {icon}
        <h2 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {count !== undefined && (
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">({count})</span>
        )}
        <span className="ml-auto text-gray-400">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {open && children}
    </div>
  );
}

function MethodologyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{value}</p>
    </div>
  );
}

function FindingCard({
  finding,
  expanded,
  onToggle,
}: {
  finding: AIScanFinding;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sev = SEVERITY_CONFIG[finding.severity];

  return (
    <div>
      {/* Header row - always visible */}
      <button onClick={onToggle} className="w-full px-6 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-gray-400">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>

          {/* Severity badge */}
          <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${sev.badge} flex-shrink-0`}>
            {finding.severity}
          </span>

          {/* Title + tags */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{finding.title}</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                {finding.category}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${CONFIDENCE_BADGE[finding.confidence]}`}>
                {finding.confidence} confidence
              </span>
            </div>

            {/* Affected files */}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {finding.affected_files.map((af, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                  <FileCode className="h-3 w-3" />
                  {af.file_path}:{af.line_numbers}
                </span>
              ))}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-6 pb-5 ml-7 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4">
          {/* Explanation */}
          <div>
            <SectionLabel>Explanation</SectionLabel>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{finding.explanation}</p>
          </div>

          {/* Proof / Evidence */}
          {finding.proof.length > 0 && (
            <div>
              <SectionLabel>Evidence</SectionLabel>
              <div className="space-y-3">
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

          {/* Recommended Action */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <SectionLabel className="text-green-700 dark:text-green-400">Recommended Action</SectionLabel>
            <p className="text-sm text-green-800 dark:text-green-300 leading-relaxed">{finding.recommended_action}</p>
          </div>

          {/* Compliance Mappings */}
          {finding.compliance_mappings.length > 0 && (
            <div>
              <SectionLabel>Compliance Mappings</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {finding.compliance_mappings.map((cm, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                    {cm.framework}: {cm.reference}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Meta footer */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
            <span>Confidence: <strong>{finding.confidence}</strong></span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>FP Risk: <strong>{finding.false_positive_risk}</strong></span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="font-mono">{finding.detection_id}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${className || "text-gray-500 dark:text-gray-400"}`}>
      {children}
    </p>
  );
}

"use client";

import { useState, useMemo } from "react";
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
import { StrengthsSection } from "@/components/dashboard/StrengthsSection";
import { GovernanceScore } from "@/components/GovernanceScore";
import { DeepScanFindingPanel } from "@/components/DeepScanFindingPanel";
import { deriveStrengths, deriveGovernanceData } from "@/lib/deep-scan-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeepScanReport {
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
  findings: DeepScanFinding[];
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
  // Optional — present only for Copilot Studio deep scans. Other scan variants
  // (agent/skill) omit these and the corresponding UI panels simply don't render.
  scan_type?: string;
  copilot_studio_profile?: CopilotStudioProfile;
  copilot_studio_completeness?: CopilotStudioCompleteness;
}

// Copilot-Studio-specific report extras. Every field is optional because a
// report may be partial, so the UI guards each access defensively.
export interface CopilotStudioAction {
  name?: string;
  connector?: string;
  access?: string;
  has_human_approval?: boolean;
}

export interface CopilotStudioHttpNode {
  location?: string;
  url?: string;
  url_is_variable_bound?: boolean;
}

export interface CopilotStudioTrigger {
  name?: string;
  type?: string;
  autonomous?: boolean;
  sender_filtered?: boolean;
}

export interface CopilotStudioProfile {
  platform?: string;
  orchestration?: string;
  general_knowledge_fallback?: string;
  moderation_level?: string;
  instructions_summary?: string;
  topics?: string[];
  actions?: CopilotStudioAction[];
  http_nodes?: CopilotStudioHttpNode[];
  knowledge_sources?: string[];
  triggers?: CopilotStudioTrigger[];
  child_agents?: string[];
  auth_mode?: string;
  channels?: string[];
  untrusted_input_channels?: string[];
}

export interface CopilotStudioCompleteness {
  subtype?: string;
  tier?: string;
  artifacts_extracted?: number;
  provided?: string[];
  missing?: string[];
  config_provided?: boolean;
  notes?: string[];
  coverage_statement?: string;
}

export interface DeepScanFinding {
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

export interface DeepScanResultsViewProps {
  report: DeepScanReport;
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
  LOW: "bg-muted text-muted-foreground border-border",
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

export function DeepScanResultsView({ report, scanMeta }: DeepScanResultsViewProps) {
  const [severityFilter, setSeverityFilter] = useState<SeverityKey | "ALL">("ALL");
  const [selectedFinding, setSelectedFinding] = useState<DeepScanFinding | null>(null);
  const [showCleanDetections, setShowCleanDetections] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  const derivedStrengths = useMemo(
    () => deriveStrengths(report.clean_detections),
    [report.clean_detections]
  );
  const governance = useMemo(() => deriveGovernanceData(report), [report]);

  // Copilot Studio extras (present only for copilot_studio deep scans).
  const cs = report.copilot_studio_profile;
  const csCompleteness = report.copilot_studio_completeness;
  const isCopilotStudio = report.scan_type === "copilot_studio" || !!cs || !!csCompleteness;

  const filteredFindings = (
    severityFilter === "ALL"
      ? [...report.findings]
      : report.findings.filter((f) => f.severity === severityFilter)
  ).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return (
    <div className="space-y-6">
      {/* ── 1. Summary Stats ── */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCell label="Files Scanned" value={scanMeta.files_scanned} />
          <StatCell label="Total Findings" value={scanMeta.findings_count} />
          <StatCell label="Critical" value={scanMeta.critical_count} className="bg-red-50 dark:bg-red-900/30" valueClassName="text-red-600 dark:text-red-400" />
          <StatCell label="High" value={scanMeta.high_count} className="bg-orange-50 dark:bg-orange-900/30" valueClassName="text-orange-600 dark:text-orange-400" />
          <StatCell label="Risk Score" value={scanMeta.risk_score} className="bg-violet-50 dark:bg-violet-900/20" valueClassName="text-violet-600 dark:text-violet-400" />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <span title="Rules that produced a Finding or Clean result. Rules marked N/A were not applicable to this agent's architecture (e.g., SQL injection on an agent with no database access). All rules were evaluated.">{report.report.detection_rules_applied} / {report.report.detection_rules_total} detection rules applied</span>
          <span className="hidden sm:inline">&middot;</span>
          <span>{report.report.total_clean} clean detections</span>
        </div>
      </div>

      {/* ── 2. Agent Profile ── */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <Cpu className="h-4 w-4 text-violet-500" />
          <h2 className="font-semibold text-foreground">Agent Profile</h2>
          {isCopilotStudio && (
            <span className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
              <Network className="h-3 w-3" />
              Microsoft Copilot Studio
              {cs?.platform ? ` · ${formatPlatform(cs.platform)}` : ""}
            </span>
          )}
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
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">High-Risk Operations</p>
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

      {/* ── 2b. Copilot Studio Configuration ── */}
      {cs && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Network className="h-4 w-4 text-violet-500" />
            <h2 className="font-semibold text-foreground">Copilot Studio Configuration</h2>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {cs.platform && <ProfileField label="Platform" value={formatPlatform(cs.platform)} />}
              {cs.orchestration && <ProfileField label="Orchestration" value={cs.orchestration} />}
              {cs.auth_mode && <ProfileField label="Authentication" value={cs.auth_mode} />}
              {cs.moderation_level && <ProfileField label="Content Moderation" value={cs.moderation_level} />}
              {cs.general_knowledge_fallback && (
                <ProfileField label="General-Knowledge Fallback" value={cs.general_knowledge_fallback} />
              )}
            </div>

            {cs.instructions_summary && (
              <ProfileField label="Instructions Summary" value={cs.instructions_summary} />
            )}

            {/* Actions / tools */}
            {Array.isArray(cs.actions) && cs.actions.length > 0 && (
              <div>
                <SectionLabel>Actions / Tools</SectionLabel>
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-muted-foreground text-xs uppercase">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Action</th>
                        <th className="text-left px-3 py-2 font-medium">Connector</th>
                        <th className="text-left px-3 py-2 font-medium">Access</th>
                        <th className="text-left px-3 py-2 font-medium">Approval</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cs.actions.map((a, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-foreground">{a.name || "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground break-all">{a.connector || "—"}</td>
                          <td className="px-3 py-2"><AccessBadge access={a.access} /></td>
                          <td className="px-3 py-2 text-xs">
                            {a.has_human_approval ? (
                              <span className="text-green-600 dark:text-green-400">Required</span>
                            ) : (
                              <span className="text-orange-600 dark:text-orange-400">None</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* HTTP endpoints */}
            {Array.isArray(cs.http_nodes) && cs.http_nodes.length > 0 && (
              <div>
                <SectionLabel>HTTP Endpoints</SectionLabel>
                <ul className="space-y-1.5">
                  {cs.http_nodes.map((h, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground break-all">{h.url || h.location || "—"}</span>
                      {h.url_is_variable_bound ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800">variable-bound</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">fixed</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Triggers */}
            {Array.isArray(cs.triggers) && cs.triggers.length > 0 && (
              <div>
                <SectionLabel>Triggers</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {cs.triggers.map((t, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                      {t.name || t.type || "trigger"}
                      {t.autonomous ? " · autonomous" : ""}
                      {t.sender_filtered === false ? " · no allow-list" : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* List columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.isArray(cs.knowledge_sources) && cs.knowledge_sources.length > 0 && (
                <SubtleList label="Knowledge Sources" items={cs.knowledge_sources} />
              )}
              {Array.isArray(cs.untrusted_input_channels) && cs.untrusted_input_channels.length > 0 && (
                <SubtleList label="Untrusted Input Channels" items={cs.untrusted_input_channels} />
              )}
              {Array.isArray(cs.topics) && cs.topics.length > 0 && (
                <SubtleList label="Topics" items={cs.topics} />
              )}
              {Array.isArray(cs.child_agents) && cs.child_agents.length > 0 && (
                <SubtleList label="Child / Connected Agents" items={cs.child_agents} />
              )}
              {Array.isArray(cs.channels) && cs.channels.length > 0 && (
                <SubtleList label="Channels" items={cs.channels} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 2c. Scan Coverage ── */}
      {csCompleteness && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Info className="h-4 w-4 text-violet-500" />
            <h2 className="font-semibold text-foreground">Scan Coverage</h2>
            {csCompleteness.tier && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium border ${TIER_CONFIG[csCompleteness.tier]?.badge || "bg-muted text-muted-foreground border-border"}`}>
                {TIER_CONFIG[csCompleteness.tier]?.label || csCompleteness.tier}
              </span>
            )}
          </div>
          <div className="p-6 space-y-4">
            {csCompleteness.coverage_statement && (
              <p className="text-sm text-muted-foreground">{csCompleteness.coverage_statement}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.isArray(csCompleteness.provided) && csCompleteness.provided.length > 0 && (
                <div>
                  <SectionLabel className="text-green-600 dark:text-green-400">Assessed</SectionLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {csCompleteness.provided.map((p, i) => (
                      <Chip key={i} label={prettyKey(p)} tone="green" />
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(csCompleteness.missing) && csCompleteness.missing.length > 0 && (
                <div>
                  <SectionLabel className="text-amber-600 dark:text-amber-400">Not assessed</SectionLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {csCompleteness.missing.map((m, i) => (
                      <Chip key={i} label={m} tone="amber" />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {Array.isArray(csCompleteness.notes) && csCompleteness.notes.length > 0 && (
              <div className="space-y-2">
                {csCompleteness.notes.map((n, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground bg-muted rounded-lg p-3">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-violet-500" />
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. Security Strengths ── */}
      <StrengthsSection strengths={derivedStrengths} />

      {/* ── 4. Governance Score ── */}
      <GovernanceScore
        score={governance.score}
        readiness={governance.readiness}
        frameworkMapping={governance.frameworkMapping}
      />

      {/* ── 5. Findings ── */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-violet-500" />
            <h2 className="font-semibold text-foreground">
              Findings
              <span className="ml-2 text-sm font-normal text-muted-foreground">
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
        <div className="divide-y divide-border">
          {filteredFindings.map((finding) => (
            <FindingCard
              key={finding.finding_number}
              finding={finding}
              onClick={() => setSelectedFinding(finding)}
            />
          ))}
          {filteredFindings.length === 0 && (
            <div className="px-6 py-12 text-center text-muted-foreground">
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

      {/* ── 6. Clean Detections ── */}
      {report.clean_detections.length > 0 && (
        <CollapsibleSection
          open={showCleanDetections}
          onToggle={() => setShowCleanDetections(!showCleanDetections)}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          title="Clean Detections"
          count={report.clean_detections.length}
        >
          <div className="divide-y divide-border">
            {report.clean_detections.map((cd, i) => (
              <div key={i} className="px-6 py-3 flex items-start gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-medium text-foreground">{cd.rule_name}</span>
                  <span className="text-muted-foreground mx-1.5">&middot;</span>
                  <span className="text-muted-foreground">{cd.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* ── 7. Compliance Summary ── */}
      {report.compliance_summary.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-violet-500" />
            <h2 className="font-semibold text-foreground">Compliance Summary</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {report.compliance_summary.map((cmp, i) => (
              <div key={i} className="border border-border rounded-lg p-4 bg-muted">
                <p className="font-medium text-sm text-foreground">{cmp.framework}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {cmp.relevant_findings.length} relevant finding{cmp.relevant_findings.length !== 1 ? "s" : ""}
                  {cmp.relevant_findings.length > 0 && (
                    <span className="ml-1 text-muted-foreground">
                      (#{cmp.relevant_findings.join(", #")})
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 8. Methodology ── */}
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

      {/* ── 9. Finding Detail Panel ── */}
      <DeepScanFindingPanel
        finding={selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCell({ label, value, className, valueClassName }: { label: string; value: number; className?: string; valueClassName?: string }) {
  return (
    <div className={`text-center p-3 rounded-lg ${className || "bg-muted"}`}>
      <p className={`text-2xl font-bold ${valueClassName || "text-foreground"}`}>{value}</p>
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function SubtleList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-muted-foreground flex-shrink-0" />
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
          ? "bg-foreground text-background border-foreground"
          : "bg-card text-muted-foreground border-border hover:border-muted-foreground"
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
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center gap-2 hover:bg-accent transition-colors"
      >
        {icon}
        <h2 className="font-semibold text-foreground">{title}</h2>
        {count !== undefined && (
          <span className="text-sm font-normal text-muted-foreground">({count})</span>
        )}
        <span className="ml-auto text-muted-foreground">
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
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-sm text-foreground leading-relaxed">{value}</p>
    </div>
  );
}

function FindingCard({
  finding,
  onClick,
}: {
  finding: DeepScanFinding;
  onClick: () => void;
}) {
  const sev = SEVERITY_CONFIG[finding.severity];

  return (
    <button onClick={onClick} className="w-full px-6 py-4 text-left hover:bg-accent transition-colors">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">
          <ChevronRight className="h-4 w-4" />
        </span>

        {/* Severity badge */}
        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${sev.badge} flex-shrink-0`}>
          {finding.severity}
        </span>

        {/* Title + tags */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className="font-medium text-sm text-foreground">{finding.title}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
              {finding.category}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${CONFIDENCE_BADGE[finding.confidence]}`}>
              {finding.confidence} confidence
            </span>
          </div>

          {/* Affected files */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {finding.affected_files.map((af, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                <FileCode className="h-3 w-3" />
                {af.file_path}:{af.line_numbers}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 ${className || "text-muted-foreground"}`}>
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Copilot Studio helpers
// ---------------------------------------------------------------------------

const TIER_CONFIG: Record<string, { label: string; badge: string }> = {
  near_complete: {
    label: "Near-complete coverage",
    badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  },
  design_time: {
    label: "Design-time coverage",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  instructions_only: {
    label: "Instructions only",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  },
  minimal: {
    label: "Minimal coverage",
    badge: "bg-muted text-muted-foreground border-border",
  },
};

function formatPlatform(p: string): string {
  const map: Record<string, string> = {
    power_platform: "Power Platform",
    m365_declarative: "Microsoft 365 Declarative",
    mixed: "Mixed",
  };
  return map[p] || p;
}

function prettyKey(k: string): string {
  const map: Record<string, string> = {
    instructions: "Instructions",
    topics: "Topics",
    actions: "Actions",
    knowledge: "Knowledge sources",
    triggers: "Triggers",
    connection_references: "Connection references",
    workflows: "Workflows",
    env_variables: "Environment variables",
    auth_config: "Authentication",
    channel_config: "Channels",
    dlp_config: "DLP policy",
    conversation_starters: "Conversation starters",
  };
  return map[k] || k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function Chip({ label, tone }: { label: string; tone: "green" | "amber" | "muted" }) {
  const cls = {
    green: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    muted: "bg-muted text-muted-foreground border-border",
  }[tone];
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      {label}
    </span>
  );
}

function AccessBadge({ access }: { access?: string }) {
  const a = (access || "").toLowerCase();
  let cls = "bg-muted text-muted-foreground border-border";
  if (a === "write" || a === "delete") {
    cls = "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800";
  } else if (a === "read") {
    cls = "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800";
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {access || "unknown"}
    </span>
  );
}

"use client";

import { cn } from "@/lib/utils";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScanResult, Finding } from "@/lib/api";

interface QuickScanResultsProps {
  result: ScanResult;
  agentName: string;
  onContinue: () => void;
  onViewFullReport: () => void;
  className?: string;
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    CRITICAL: "bg-red-100 text-red-700 border-red-200",
    HIGH: "bg-orange-100 text-orange-700 border-orange-200",
    MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
    LOW: "bg-blue-100 text-blue-700 border-blue-200",
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
      colors[severity as keyof typeof colors] || colors.LOW
    )}>
      {severity}
    </span>
  );
}

function FindingPreview({ finding }: { finding: Finding }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
      <div className="flex-shrink-0 mt-0.5">
        {finding.severity === "CRITICAL" || finding.severity === "HIGH" ? (
          <AlertCircle className="w-4 h-4 text-red-600" />
        ) : finding.severity === "MEDIUM" ? (
          <AlertTriangle className="w-4 h-4 text-amber-600" />
        ) : (
          <Info className="w-4 h-4 text-blue-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">
            {finding.pattern || finding.message.split(".")[0]}
          </span>
          <SeverityBadge severity={finding.severity} />
        </div>
        <p className="mt-1 text-xs text-gray-500 line-clamp-1">
          {finding.file}:{finding.line}
        </p>
      </div>
    </div>
  );
}

function getRiskLevel(score: number): { label: string; color: string; icon: typeof Shield } {
  if (score >= 80) return { label: "Critical Risk", color: "text-red-600", icon: AlertTriangle };
  if (score >= 60) return { label: "High Risk", color: "text-orange-600", icon: AlertTriangle };
  if (score >= 40) return { label: "Medium Risk", color: "text-amber-600", icon: AlertTriangle };
  if (score >= 20) return { label: "Low Risk", color: "text-blue-600", icon: Shield };
  return { label: "Minimal Risk", color: "text-emerald-600", icon: CheckCircle2 };
}

export function QuickScanResults({
  result,
  agentName,
  onContinue,
  onViewFullReport,
  className,
}: QuickScanResultsProps) {
  const riskLevel = getRiskLevel(result.risk_score);
  const RiskIcon = riskLevel.icon;
  const topFindings = result.findings.slice(0, 3);

  return (
    <div className={cn("w-full max-w-2xl mx-auto", className)}>
      {/* Hero Stats */}
      <div className="text-center mb-8">
        <div className={cn(
          "inline-flex items-center justify-center w-16 h-16 rounded-full mb-4",
          result.risk_score >= 60 ? "bg-red-100" : result.risk_score >= 30 ? "bg-amber-100" : "bg-emerald-100"
        )}>
          <RiskIcon className={cn("w-8 h-8", riskLevel.color)} />
        </div>

        <h2 className="text-2xl font-bold text-gray-900">
          Scan Complete
        </h2>
        <p className="mt-1 text-gray-500">
          {agentName}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="text-center p-4 rounded-xl bg-gray-50">
          <div className={cn("text-3xl font-bold", riskLevel.color)}>
            {result.risk_score}
          </div>
          <div className="text-xs text-gray-500 mt-1">Risk Score</div>
        </div>
        <div className="text-center p-4 rounded-xl bg-gray-50">
          <div className="text-3xl font-bold text-gray-900">
            {result.findings_count}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {result.findings_count === 1 ? "Finding" : "Findings"}
          </div>
        </div>
        <div className="text-center p-4 rounded-xl bg-gray-50">
          <div className="text-3xl font-bold text-gray-900">
            {result.governance_score || 0}%
          </div>
          <div className="text-xs text-gray-500 mt-1">Governance</div>
        </div>
      </div>

      {/* Severity Breakdown */}
      {result.findings_count > 0 && (
        <div className="flex justify-center gap-4 mb-8">
          {result.critical_count > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-sm text-gray-600">
                {result.critical_count} Critical
              </span>
            </div>
          )}
          {result.high_count > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-sm text-gray-600">
                {result.high_count} High
              </span>
            </div>
          )}
          {result.medium_count > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm text-gray-600">
                {result.medium_count} Medium
              </span>
            </div>
          )}
          {result.low_count > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-sm text-gray-600">
                {result.low_count} Low
              </span>
            </div>
          )}
        </div>
      )}

      {/* Top Findings Preview */}
      {topFindings.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Top Findings
          </h3>
          <div className="space-y-2">
            {topFindings.map((finding, idx) => (
              <FindingPreview key={finding.id || idx} finding={finding} />
            ))}
          </div>
          {result.findings.length > 3 && (
            <button
              onClick={onViewFullReport}
              className="w-full mt-2 text-sm text-gray-500 hover:text-gray-700 py-2"
            >
              +{result.findings.length - 3} more findings
            </button>
          )}
        </div>
      )}

      {/* EU AI Act Status */}
      <div className={cn(
        "flex items-center justify-between p-4 rounded-xl mb-8",
        result.eu_ai_act_readiness === "READY"
          ? "bg-emerald-50 border border-emerald-200"
          : result.eu_ai_act_readiness === "PARTIAL"
          ? "bg-amber-50 border border-amber-200"
          : "bg-red-50 border border-red-200"
      )}>
        <div className="flex items-center gap-3">
          <Shield className={cn(
            "w-5 h-5",
            result.eu_ai_act_readiness === "READY"
              ? "text-emerald-600"
              : result.eu_ai_act_readiness === "PARTIAL"
              ? "text-amber-600"
              : "text-red-600"
          )} />
          <div>
            <div className="text-sm font-medium text-gray-900">
              EU AI Act Readiness
            </div>
            <div className="text-xs text-gray-500">
              Article 14 compliance assessment
            </div>
          </div>
        </div>
        <span className={cn(
          "px-3 py-1 rounded-full text-xs font-medium",
          result.eu_ai_act_readiness === "READY"
            ? "bg-emerald-100 text-emerald-700"
            : result.eu_ai_act_readiness === "PARTIAL"
            ? "bg-amber-100 text-amber-700"
            : "bg-red-100 text-red-700"
        )}>
          {result.eu_ai_act_readiness === "READY"
            ? "Ready"
            : result.eu_ai_act_readiness === "PARTIAL"
            ? "Partial"
            : "Not Ready"}
        </span>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={onViewFullReport}
          variant="outline"
          className="flex-1"
        >
          View Full Report
        </Button>
        <Button
          onClick={onContinue}
          className="flex-1 bg-gray-900 hover:bg-gray-800"
        >
          Continue to Dashboard
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

import type { Strength } from "@/lib/api";
import type { AIScanReport } from "@/components/AIScanResultsView";

// ---------------------------------------------------------------------------
// deriveStrengths
// ---------------------------------------------------------------------------

type ControlType = Strength["control_type"];

interface StrengthRule {
  test: (ruleName: string) => boolean;
  control_type: ControlType;
  title: string;
}

const STRENGTH_RULES: StrengthRule[] = [
  {
    test: (r) => /oversight|human/i.test(r),
    control_type: "oversight",
    title: "Human Oversight Configured",
  },
  {
    test: (r) => /authorization|authz/i.test(r),
    control_type: "authorization",
    title: "Authorization Checks Detected",
  },
  {
    test: (r) => /audit|logging/i.test(r) && !/sensitive/i.test(r),
    control_type: "audit",
    title: "Audit Trail Enabled",
  },
  {
    test: (r) => /rate_limit|rate limit/i.test(r),
    control_type: "rate_limit",
    title: "Rate Limiting Configured",
  },
];

export function deriveStrengths(
  cleanDetections: AIScanReport["clean_detections"]
): Strength[] {
  const seen = new Set<ControlType>();
  const strengths: Strength[] = [];

  for (const cd of cleanDetections) {
    for (const rule of STRENGTH_RULES) {
      if (rule.test(cd.rule_name) && !seen.has(rule.control_type)) {
        seen.add(rule.control_type);
        strengths.push({
          id: cd.detection_id,
          pattern_id: cd.detection_id,
          control_type: rule.control_type,
          title: rule.title,
          message: cd.reason,
        });
        break; // one rule match per clean detection
      }
    }
  }

  return strengths;
}

// ---------------------------------------------------------------------------
// deriveGovernanceData
// ---------------------------------------------------------------------------

type ReadinessStatus = "READY" | "PARTIAL" | "NOT_READY";

interface FrameworkStatus {
  framework: string;
  status: "PASS" | "PARTIAL" | "FAIL";
  finding_count: number;
}

export interface GovernanceData {
  score: number;
  readiness: ReadinessStatus;
  frameworkMapping: Record<string, FrameworkStatus>;
}

const FRAMEWORK_PREFIXES = ["EU AI Act", "OWASP", "NIST", "ISO"];

export function deriveGovernanceData(report: AIScanReport): GovernanceData {
  // --- Score ---
  const sev = report.severity_summary;
  let score = 100;
  score -= (sev.critical ?? 0) * 25;
  score -= (sev.high ?? 0) * 15;
  score -= (sev.medium ?? 0) * 5;

  // Bonus from clean governance controls
  const cleanTypes = new Set<ControlType>();
  for (const cd of report.clean_detections) {
    for (const rule of STRENGTH_RULES) {
      if (rule.test(cd.rule_name)) {
        cleanTypes.add(rule.control_type);
        break;
      }
    }
  }

  if (cleanTypes.has("oversight")) score += 15;
  if (cleanTypes.has("authorization")) score += 10;
  if (cleanTypes.has("audit")) score += 5;
  if (cleanTypes.has("rate_limit")) score += 5;

  score = Math.max(0, Math.min(100, score));

  // --- Readiness ---
  const readiness: ReadinessStatus =
    score >= 80 ? "READY" : score >= 40 ? "PARTIAL" : "NOT_READY";

  // --- Framework mapping ---
  const frameworkMapping: Record<string, FrameworkStatus> = {};

  // Group compliance_summary entries by framework prefix
  const groups: Record<string, AIScanReport["compliance_summary"]> = {};
  for (const entry of report.compliance_summary) {
    const prefix = FRAMEWORK_PREFIXES.find((p) =>
      entry.framework.startsWith(p)
    );
    const key = prefix ?? entry.framework;
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  }

  // Resolve finding severities for status determination
  const findingSeverityMap = new Map<number, string>();
  for (const f of report.findings) {
    findingSeverityMap.set(f.finding_number, f.severity);
  }

  for (const [fw, entries] of Object.entries(groups)) {
    const allFindingNumbers = entries.flatMap((e) => e.relevant_findings);

    if (allFindingNumbers.length === 0) {
      frameworkMapping[fw] = { framework: fw, status: "PASS", finding_count: 0 };
      continue;
    }

    const hasCriticalOrHigh = allFindingNumbers.some((num) => {
      const sev = findingSeverityMap.get(num);
      return sev === "CRITICAL" || sev === "HIGH";
    });

    frameworkMapping[fw] = {
      framework: fw,
      status: hasCriticalOrHigh ? "FAIL" : "PARTIAL",
      finding_count: allFindingNumbers.length,
    };
  }

  return { score, readiness, frameworkMapping };
}

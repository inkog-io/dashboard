/**
 * Shared utilities for finding filtering and classification.
 * Used by both scan/page.tsx and results/[id]/page.tsx for consistent behavior.
 */

import type { Finding, FindingType } from "@/lib/api";

/**
 * Determines finding type - prefers explicit finding_type, falls back to heuristic.
 * Governance patterns typically include "missing_", "oversight", "rate_limit", etc.
 */
export function getFindingType(finding: Finding): FindingType {
  // Prefer explicit type if set by backend
  if (finding.finding_type) {
    return finding.finding_type;
  }

  // Fallback heuristic for older scans without finding_type
  const patternId = finding.pattern_id?.toLowerCase() || '';
  const governancePatterns = [
    'missing_',
    'oversight',
    'rate_limit',
    'audit',
    'authorization',
    'human_',
    'logging',
  ];

  return governancePatterns.some(p => patternId.includes(p))
    ? 'governance_violation'
    : 'vulnerability';
}

/**
 * Unified search function - searches all fields including compliance mappings.
 * Returns true if finding matches the query.
 */
export function matchesFindingSearch(finding: Finding, query: string): boolean {
  if (!query) return true;

  const q = query.toLowerCase();

  // Basic fields
  if (finding.message?.toLowerCase().includes(q)) return true;
  if (finding.pattern_id?.toLowerCase().includes(q)) return true;
  if (finding.file?.toLowerCase().includes(q)) return true;
  if (finding.cwe?.toLowerCase().includes(q)) return true;
  if (finding.owasp_category?.toLowerCase().includes(q)) return true;
  if (finding.pattern?.toLowerCase().includes(q)) return true;
  if (finding.category?.toLowerCase().includes(q)) return true;

  // Compliance mappings
  const cm = finding.compliance_mapping;
  if (cm) {
    if (cm.eu_ai_act_articles?.some(a => a.toLowerCase().includes(q))) return true;
    if (cm.nist_categories?.some(c => c.toLowerCase().includes(q))) return true;
    if (cm.iso_42001_clauses?.some(c => c.toLowerCase().includes(q))) return true;
    if (cm.owasp_items?.some(i => i.toLowerCase().includes(q))) return true;
    if (cm.cwe_ids?.some(c => c.toLowerCase().includes(q))) return true;
    if (cm.gdpr_articles?.some(a => a.toLowerCase().includes(q))) return true;
  }

  return false;
}

/**
 * Check if finding belongs to a specific compliance framework.
 * Framework IDs match what GovernanceScore uses: 'eu-ai-act', 'nist-ai-rmf', 'iso-42001', 'owasp-llm'
 */
export function matchesFramework(finding: Finding, frameworkId: string): boolean {
  const cm = finding.compliance_mapping;
  if (!cm) return false;

  switch (frameworkId) {
    case 'eu-ai-act':
      return (cm.eu_ai_act_articles?.length ?? 0) > 0;
    case 'nist-ai-rmf':
      return (cm.nist_categories?.length ?? 0) > 0;
    case 'iso-42001':
      return (cm.iso_42001_clauses?.length ?? 0) > 0;
    case 'owasp-llm':
      return (cm.owasp_items?.length ?? 0) > 0;
    default:
      return false;
  }
}

/**
 * Display names for framework IDs
 */
export const frameworkDisplayNames: Record<string, string> = {
  'eu-ai-act': 'EU AI Act',
  'nist-ai-rmf': 'NIST AI RMF',
  'iso-42001': 'ISO 42001',
  'owasp-llm': 'OWASP LLM Top 10',
};

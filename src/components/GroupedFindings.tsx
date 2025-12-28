"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Finding } from "@/lib/api";
import { FindingCard } from "./FindingCard";

interface GroupedFindingsProps {
  findings: Finding[];
  onFindingClick: (finding: Finding) => void;
}

interface FindingGroup {
  key: string;
  file: string;
  line: number;
  findings: Finding[];
}

/**
 * Groups findings by file:line and renders them with collapsible sections
 * when multiple findings exist on the same line.
 */
export function GroupedFindings({ findings, onFindingClick }: GroupedFindingsProps) {
  // Track which groups are expanded (groups with >1 finding start collapsed)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Group findings by file:line
  const groups: FindingGroup[] = useMemo(() => {
    const groupMap = new Map<string, FindingGroup>();

    for (const finding of findings) {
      const key = `${finding.file}:${finding.line}`;

      if (groupMap.has(key)) {
        groupMap.get(key)!.findings.push(finding);
      } else {
        groupMap.set(key, {
          key,
          file: finding.file,
          line: finding.line,
          findings: [finding],
        });
      }
    }

    // Return groups in order of first finding's appearance
    return Array.from(groupMap.values());
  }, [findings]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Get the highest severity in a group
  const getGroupSeverity = (findings: Finding[]) => {
    const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    let maxSeverity: keyof typeof severityOrder = "LOW";
    for (const f of findings) {
      const sev = f.severity as keyof typeof severityOrder;
      if (severityOrder[sev] > severityOrder[maxSeverity]) {
        maxSeverity = sev;
      }
    }
    return maxSeverity;
  };

  const severityColors: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400",
    HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400",
    MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400",
    LOW: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
  };

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {groups.map((group) => {
        const isMultiple = group.findings.length > 1;
        const isExpanded = expandedGroups.has(group.key);
        const groupSeverity = getGroupSeverity(group.findings);

        // Single finding - render directly
        if (!isMultiple) {
          return (
            <FindingCard
              key={group.findings[0].id || group.key}
              finding={group.findings[0]}
              onClick={() => onFindingClick(group.findings[0])}
            />
          );
        }

        // Multiple findings - render collapsible group
        return (
          <div key={group.key} className="bg-white dark:bg-gray-900">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.key)}
              className="w-full text-left px-5 py-3 flex items-center justify-between gap-3 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors duration-150 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-800"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}

                <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-sm text-gray-700 dark:text-gray-300">
                  {group.file}:{group.line}
                </code>

                <span
                  className={`px-2 py-0.5 text-xs font-semibold rounded-full ${severityColors[groupSeverity]}`}
                >
                  {group.findings.length} findings
                </span>
              </div>
            </button>

            {/* Expanded findings */}
            {isExpanded && (
              <div className="border-l-2 border-gray-200 dark:border-gray-700 ml-7">
                {group.findings.map((finding, index) => (
                  <FindingCard
                    key={finding.id || `${group.key}-${index}`}
                    finding={finding}
                    onClick={() => onFindingClick(finding)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

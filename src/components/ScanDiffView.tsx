'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Plus,
  Check,
  Minus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronRight,
  FileCode,
  Clock,
} from 'lucide-react';
import { DiffResult, DiffFinding, DiffSummary } from '@/lib/api';
import { getPatternLabel } from '@/lib/patternLabels';

interface ScanDiffViewProps {
  diff: DiffResult;
  onClose?: () => void;
}

type DiffTab = 'new' | 'fixed' | 'unchanged';

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: {
    bg: 'bg-red-50 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  HIGH: {
    bg: 'bg-orange-50 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
  },
  MEDIUM: {
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
  },
  LOW: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
};

function SeverityBadge({ severity }: { severity: string }) {
  const colors = severityColors[severity] || severityColors.LOW;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${colors.bg} ${colors.text}`}
    >
      {severity}
    </span>
  );
}

function DiffStatusBadge({ status }: { status: 'new' | 'fixed' | 'unchanged' }) {
  if (status === 'new') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
        <Plus className="h-3 w-3" />
        NEW
      </span>
    );
  }
  if (status === 'fixed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
        <Check className="h-3 w-3" />
        FIXED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
      <Minus className="h-3 w-3" />
      UNCHANGED
    </span>
  );
}

function DiffSummaryCard({ summary }: { summary: DiffSummary }) {
  const isRegression = (summary.new_by_severity?.CRITICAL || 0) > 0 || (summary.new_by_severity?.HIGH || 0) > 0;
  const isImprovement = !isRegression && ((summary.fixed_by_severity?.CRITICAL || 0) > 0 || (summary.fixed_by_severity?.HIGH || 0) > 0);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Diff Summary
        </h3>
        {isRegression && (
          <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Security Regression
          </span>
        )}
        {isImprovement && (
          <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
            <Shield className="h-4 w-4" />
            Security Improved
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            +{summary.total_new}
          </div>
          <div className="text-sm text-red-600 dark:text-red-400">New Findings</div>
        </div>
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            -{summary.total_fixed}
          </div>
          <div className="text-sm text-green-600 dark:text-green-400">Fixed Findings</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {summary.total_unchanged}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Unchanged</div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Risk Score:</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {summary.base_risk_score}
          </span>
          <span className="text-gray-400">→</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {summary.head_risk_score}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {summary.risk_delta > 0 ? (
            <TrendingUp className="h-4 w-4 text-red-500" />
          ) : summary.risk_delta < 0 ? (
            <TrendingDown className="h-4 w-4 text-green-500" />
          ) : null}
          <span
            className={`font-medium ${
              summary.risk_delta > 0
                ? 'text-red-500'
                : summary.risk_delta < 0
                ? 'text-green-500'
                : 'text-gray-500'
            }`}
          >
            {summary.risk_delta > 0 ? '+' : ''}
            {summary.risk_delta}
          </span>
        </div>
      </div>
    </div>
  );
}

function DiffFindingRow({
  finding,
  status,
  isExpanded,
  onToggle,
}: {
  finding: DiffFinding;
  status: 'new' | 'fixed' | 'unchanged';
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`border-b border-gray-100 dark:border-gray-800 last:border-0 ${
        status === 'new'
          ? 'bg-red-50/50 dark:bg-red-900/10'
          : status === 'fixed'
          ? 'bg-green-50/50 dark:bg-green-900/10'
          : ''
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}
        <DiffStatusBadge status={status} />
        <SeverityBadge severity={finding.severity} />
        <span className="font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
          {getPatternLabel(finding.pattern_id).title}
        </span>
        <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          <FileCode className="h-4 w-4" />
          {finding.file}:{finding.line}
        </span>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pl-11">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {finding.message}
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
            <span>Category: {finding.category}</span>
            {finding.owasp_category && <span>OWASP: {finding.owasp_category}</span>}
            <span>Confidence: {Math.round(finding.confidence * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ScanDiffView({ diff }: ScanDiffViewProps) {
  const [activeTab, setActiveTab] = useState<DiffTab>('new');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const currentFindings = useMemo(() => {
    switch (activeTab) {
      case 'new':
        return diff.new_findings;
      case 'fixed':
        return diff.fixed_findings;
      case 'unchanged':
        return diff.unchanged_findings;
      default:
        return [];
    }
  }, [activeTab, diff]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const tabs: { id: DiffTab; label: string; count: number; color: string }[] = [
    {
      id: 'new',
      label: 'New Findings',
      count: diff.summary.total_new,
      color: 'text-red-600 dark:text-red-400',
    },
    {
      id: 'fixed',
      label: 'Fixed',
      count: diff.summary.total_fixed,
      color: 'text-green-600 dark:text-green-400',
    },
    {
      id: 'unchanged',
      label: 'Unchanged',
      count: diff.summary.total_unchanged,
      color: 'text-gray-600 dark:text-gray-400',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Scan Comparison Header */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Clock className="h-4 w-4" />
        <span>Comparing:</span>
        {diff.base_scan_id ? (
          <>
            <span className="font-medium">
              {format(new Date(diff.base_scan_time), 'MMM d, yyyy HH:mm')}
            </span>
            <span>→</span>
            <span className="font-medium">
              {format(new Date(diff.head_scan_time), 'MMM d, yyyy HH:mm')}
            </span>
          </>
        ) : (
          <span className="font-medium">First scan (all findings are new)</span>
        )}
      </div>

      {/* Summary Card */}
      <DiffSummaryCard summary={diff.summary} />

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? `border-indigo-500 ${tab.color}`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </nav>
      </div>

      {/* Findings List */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {currentFindings.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No {activeTab} findings
          </div>
        ) : (
          currentFindings.map((finding) => (
            <DiffFindingRow
              key={finding.id}
              finding={finding}
              status={activeTab}
              isExpanded={expandedIds.has(finding.id)}
              onToggle={() => toggleExpanded(finding.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ScanDiffView;

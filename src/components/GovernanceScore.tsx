'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Shield, FileText, Award, AlertTriangle } from 'lucide-react';

type ReadinessStatus = 'READY' | 'PARTIAL' | 'NOT_READY' | 'PASS' | 'FAIL';

interface FrameworkStatus {
  framework: string;
  status: ReadinessStatus;
  finding_count: number;
  description?: string;
}

interface ArticleStatus {
  article: string;
  status: ReadinessStatus;
  finding_count: number;
  description: string;
}

interface GovernanceScoreProps {
  score?: number;
  readiness?: ReadinessStatus;
  articleMapping?: Record<string, ArticleStatus>;
  frameworkMapping?: Record<string, FrameworkStatus>;
  euAiActDeadline?: string; // Optional deadline prop, no hardcoded default
  onFrameworkClick?: (frameworkId: string) => void;
  onArticleClick?: (articleId: string) => void;
}

/**
 * GovernanceScore displays a unified governance score with drill-down
 * into individual compliance frameworks (EU AI Act, NIST, ISO 42001, OWASP).
 */
export function GovernanceScore({
  score,
  readiness,
  articleMapping,
  frameworkMapping,
  euAiActDeadline,
  onFrameworkClick,
  onArticleClick,
}: GovernanceScoreProps) {
  const [expandedFrameworks, setExpandedFrameworks] = useState<Set<string>>(new Set());

  const statusColors: Record<string, string> = {
    'READY': 'text-green-600 dark:text-green-400',
    'PASS': 'text-green-600 dark:text-green-400',
    'PARTIAL': 'text-yellow-600 dark:text-yellow-400',
    'NOT_READY': 'text-red-600 dark:text-red-400',
    'FAIL': 'text-red-600 dark:text-red-400',
  };

  const statusLabels: Record<string, string> = {
    'READY': 'Ready',
    'PASS': 'Pass',
    'PARTIAL': 'Partial',
    'NOT_READY': 'Not Ready',
    'FAIL': 'Fail',
  };

  const statusBgColors: Record<string, string> = {
    'READY': 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    'PASS': 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    'PARTIAL': 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
    'NOT_READY': 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    'FAIL': 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
  };

  // Default values if not provided
  const displayScore = score ?? 0;
  const displayReadiness = readiness ?? 'NOT_READY';

  // Calculate score color based on value
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600 dark:text-green-400';
    if (s >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreStrokeColor = (s: number) => {
    if (s >= 80) return '#22c55e';
    if (s >= 50) return '#eab308';
    return '#ef4444';
  };

  const toggleFramework = (framework: string) => {
    const newExpanded = new Set(expandedFrameworks);
    if (newExpanded.has(framework)) {
      newExpanded.delete(framework);
    } else {
      newExpanded.add(framework);
    }
    setExpandedFrameworks(newExpanded);
  };

  // Build framework list with icons - all frameworks treated equally
  // Backend returns keys with spaces like "NIST AI RMF", so we use those exact keys
  const frameworks = [
    {
      id: 'eu-ai-act',
      name: 'EU AI Act',
      icon: FileText,
      // EU AI Act uses articleMapping, not frameworkMapping
      status: articleMapping && Object.keys(articleMapping).length > 0
        ? (Object.values(articleMapping).some(a => a.status === 'FAIL') ? 'FAIL' : 'PARTIAL')
        : displayReadiness,
      findingCount: articleMapping
        ? Object.values(articleMapping).reduce((sum, a) => sum + a.finding_count, 0)
        : 0,
      deadline: euAiActDeadline,
      articles: articleMapping ? Object.values(articleMapping) : [],
    },
    {
      id: 'nist-ai-rmf',
      name: 'NIST AI RMF',
      icon: Shield,
      status: frameworkMapping?.['NIST AI RMF']?.status ?? 'NOT_READY',
      findingCount: frameworkMapping?.['NIST AI RMF']?.finding_count ?? 0,
    },
    {
      id: 'iso-42001',
      name: 'ISO 42001',
      icon: Award,
      status: frameworkMapping?.['ISO 42001']?.status ?? 'NOT_READY',
      findingCount: frameworkMapping?.['ISO 42001']?.finding_count ?? 0,
    },
    {
      id: 'owasp-llm',
      name: 'OWASP LLM Top 10',
      icon: AlertTriangle,
      status: frameworkMapping?.['OWASP LLM Top 10']?.status ?? 'NOT_READY',
      findingCount: frameworkMapping?.['OWASP LLM Top 10']?.finding_count ?? 0,
    },
  ];

  return (
    <div className="bg-card rounded-lg shadow p-6 border border-border">
      <h3 className="text-lg font-semibold mb-4 text-foreground">
        Governance Score
      </h3>

      <div className="flex items-start gap-6">
        {/* Score Circle */}
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              className="text-muted"
              strokeWidth="10"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={getScoreStrokeColor(displayScore)}
              strokeWidth="10"
              strokeDasharray={`${displayScore * 2.51} 251`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-bold ${getScoreColor(displayScore)}`}>
              {displayScore}
            </span>
          </div>
        </div>

        {/* Framework Accordions */}
        <div className="flex-1 space-y-2">
          {frameworks.map((framework) => {
            const Icon = framework.icon;
            const isExpanded = expandedFrameworks.has(framework.id);
            // Any framework with articles can be expanded
            const hasDetails = framework.articles && framework.articles.length > 0;

            return (
              <div
                key={framework.id}
                className="border border-border rounded-lg overflow-hidden"
              >
                {/* Framework Header */}
                <button
                  onClick={() => hasDetails && toggleFramework(framework.id)}
                  className={`w-full flex items-center justify-between p-3 text-left transition-colors
                    ${hasDetails ? 'hover:bg-muted cursor-pointer' : 'cursor-default'}
                    bg-muted/50`}
                  disabled={!hasDetails}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {framework.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${statusBgColors[framework.status]} ${statusColors[framework.status]}`}
                    >
                      {statusLabels[framework.status] ?? framework.status}
                    </span>
                    {hasDetails && (
                      isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )
                    )}
                  </div>
                </button>

                {/* Expanded Articles (any framework with article details) */}
                {isExpanded && framework.articles && framework.articles.length > 0 && (
                  <div className="p-3 bg-background border-t border-border">
                    <div className="space-y-2">
                      {framework.articles.map((article) => (
                        <button
                          key={article.article}
                          onClick={() => article.finding_count > 0 && onArticleClick?.(article.article)}
                          disabled={article.finding_count === 0}
                          className={`w-full flex items-center justify-between text-sm p-2 rounded-md transition-colors ${
                            article.finding_count > 0
                              ? 'hover:bg-muted cursor-pointer'
                              : 'cursor-default'
                          }`}
                        >
                          <div className="text-left">
                            <span className="font-medium text-foreground">
                              {article.article}
                            </span>
                            {article.description && (
                              <span className="text-muted-foreground ml-2">
                                - {article.description}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {article.finding_count > 0 && (
                              <span className="text-xs text-primary hover:underline">
                                View →
                              </span>
                            )}
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border ${statusBgColors[article.status]} ${statusColors[article.status]}`}
                            >
                              {statusLabels[article.status] ?? article.status}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                    {framework.deadline && (
                      <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border">
                        Compliance deadline: {framework.deadline}
                      </p>
                    )}
                  </div>
                )}

                {/* View details link - only show for frameworks with issues */}
                {!isExpanded && framework.status !== 'READY' && framework.status !== 'PASS' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onFrameworkClick?.(framework.id);
                    }}
                    className="w-full px-3 py-2 bg-background border-t border-border text-left hover:bg-muted transition-colors"
                  >
                    <span className="text-xs text-muted-foreground hover:text-foreground">
                      View requirements →
                    </span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default GovernanceScore;

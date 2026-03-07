'use client';

import { ArticleStatus, FrameworkStatus } from '@/lib/api';

interface ComplianceMappingProps {
  articleMapping?: Record<string, ArticleStatus>;
  frameworkMapping?: Record<string, FrameworkStatus>;
  onFrameworkClick?: (framework: string) => void;
  onArticleClick?: (article: string) => void;
}

/**
 * ComplianceMapping displays compliance status for AI governance frameworks
 * including EU AI Act, OWASP LLM Top 10, ISO 42001, and NIST AI RMF.
 */
export function ComplianceMapping({
  articleMapping,
  frameworkMapping,
  onFrameworkClick,
  onArticleClick,
}: ComplianceMappingProps) {
  const getStatusIcon = (status: 'PASS' | 'PARTIAL' | 'FAIL') => {
    switch (status) {
      case 'PASS':
        return <span className="text-green-500 dark:text-green-400">&#x2713;</span>;
      case 'PARTIAL':
        return <span className="text-yellow-500 dark:text-yellow-400">&#x26A0;</span>;
      case 'FAIL':
        return <span className="text-red-500 dark:text-red-400">&#x2717;</span>;
    }
  };

  const getStatusBadgeColor = (status: 'PASS' | 'PARTIAL' | 'FAIL') => {
    switch (status) {
      case 'PASS':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'PARTIAL':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'FAIL':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800';
    }
  };

  const hasArticles = articleMapping && Object.keys(articleMapping).length > 0;
  const hasFrameworks = frameworkMapping && Object.keys(frameworkMapping).length > 0;

  if (!hasArticles && !hasFrameworks) {
    return (
      <div className="bg-card rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Compliance Mapping</h3>
        <p className="text-muted-foreground text-sm">No compliance data available for this scan.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4 text-foreground">Compliance Mapping</h3>

      <div className="space-y-2">
        {/* All Frameworks - unified display */}
        {hasFrameworks && Object.entries(frameworkMapping!).map(([framework, status]) => (
          <button
            key={framework}
            onClick={() => status.finding_count > 0 && onFrameworkClick?.(framework)}
            disabled={status.finding_count === 0}
            className={`w-full flex items-center justify-between p-3 bg-muted rounded-lg transition-colors ${
              status.finding_count > 0
                ? 'hover:bg-accent cursor-pointer'
                : 'cursor-default'
            }`}
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(status.status)}
              <span className="font-medium text-foreground">{status.framework}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusBadgeColor(status.status)}`}>
                {status.status}
              </span>
              {status.finding_count > 0 && (
                <span className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                  {status.finding_count} finding{status.finding_count !== 1 ? 's' : ''} →
                </span>
              )}
            </div>
          </button>
        ))}

        {/* Article Details (if available) */}
        {hasArticles && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Article Details</h4>
            <div className="space-y-2">
              {Object.entries(articleMapping!).map(([article, status]) => (
                <button
                  key={article}
                  onClick={() => status.finding_count > 0 && onArticleClick?.(status.article)}
                  disabled={status.finding_count === 0}
                  className={`w-full flex items-center justify-between p-3 bg-muted rounded-lg transition-colors ${
                    status.finding_count > 0
                      ? 'hover:bg-accent cursor-pointer'
                      : 'cursor-default'
                  }`}
                >
                  <div className="flex items-center gap-3 text-left">
                    {getStatusIcon(status.status)}
                    <div>
                      <span className="font-medium text-foreground">{status.article}</span>
                      {status.description && (
                        <span className="text-muted-foreground text-sm ml-2">({status.description})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusBadgeColor(status.status)}`}>
                      {status.status}
                    </span>
                    {status.finding_count > 0 && (
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                        {status.finding_count} finding{status.finding_count !== 1 ? 's' : ''} →
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ComplianceMapping;

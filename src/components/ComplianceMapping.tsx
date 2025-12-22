'use client';

import { ArticleStatus, FrameworkStatus } from '@/lib/api';

interface ComplianceMappingProps {
  articleMapping?: Record<string, ArticleStatus>;
  frameworkMapping?: Record<string, FrameworkStatus>;
}

/**
 * ComplianceMapping displays compliance status for EU AI Act articles
 * and security frameworks (OWASP, ISO, NIST).
 */
export function ComplianceMapping({ articleMapping, frameworkMapping }: ComplianceMappingProps) {
  const getStatusIcon = (status: 'PASS' | 'PARTIAL' | 'FAIL') => {
    switch (status) {
      case 'PASS':
        return <span className="text-green-500">&#x2713;</span>;
      case 'PARTIAL':
        return <span className="text-yellow-500">&#x26A0;</span>;
      case 'FAIL':
        return <span className="text-red-500">&#x2717;</span>;
    }
  };

  const getStatusBadgeColor = (status: 'PASS' | 'PARTIAL' | 'FAIL') => {
    switch (status) {
      case 'PASS':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PARTIAL':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'FAIL':
        return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const hasArticles = articleMapping && Object.keys(articleMapping).length > 0;
  const hasFrameworks = frameworkMapping && Object.keys(frameworkMapping).length > 0;

  if (!hasArticles && !hasFrameworks) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Compliance Mapping</h3>
        <p className="text-gray-500 text-sm">No compliance data available for this scan.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Compliance Mapping</h3>

      <div className="space-y-6">
        {/* EU AI Act Articles */}
        {hasArticles && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">EU AI Act</h4>
            <div className="space-y-2">
              {Object.entries(articleMapping!).map(([article, status]) => (
                <div
                  key={article}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(status.status)}
                    <div>
                      <span className="font-medium text-gray-900">{status.article}</span>
                      {status.description && (
                        <span className="text-gray-500 text-sm ml-2">({status.description})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusBadgeColor(status.status)}`}>
                      {status.status}
                    </span>
                    {status.finding_count > 0 && (
                      <span className="text-xs text-gray-500">
                        {status.finding_count} finding{status.finding_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security Frameworks */}
        {hasFrameworks && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Security Frameworks</h4>
            <div className="space-y-2">
              {Object.entries(frameworkMapping!).map(([framework, status]) => (
                <div
                  key={framework}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(status.status)}
                    <span className="font-medium text-gray-900">{status.framework}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusBadgeColor(status.status)}`}>
                      {status.status}
                    </span>
                    {status.finding_count > 0 && (
                      <span className="text-xs text-gray-500">
                        {status.finding_count} finding{status.finding_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ComplianceMapping;

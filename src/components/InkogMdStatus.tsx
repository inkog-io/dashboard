'use client';

import { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Shield,
  Eye,
  Database,
  Wrench,
} from 'lucide-react';

export interface InkogMdManifest {
  version: string;
  file_path: string;
  is_valid: boolean;
  capabilities: Array<{
    name: string;
    description?: string;
    aliases?: string[];
  }>;
  limitations: Array<{
    type: string;
    description: string;
  }>;
  human_oversight: {
    require_approval: string[];
    notify_on: string[];
  };
  data_handling: Array<{
    category: string;
    action: string;
    note?: string;
  }>;
  parse_errors?: Array<{
    line: number;
    message: string;
    level: 'error' | 'warning' | 'info';
  }>;
}

export interface InkogMdValidation {
  is_compliant: boolean;
  score: number;
  undeclared_capabilities: string[];
  unused_capabilities: string[];
  missing_oversight: string[];
  data_policy_violations: Array<{
    file: string;
    line: number;
    description: string;
  }>;
}

interface InkogMdStatusProps {
  manifest?: InkogMdManifest | null;
  validation?: InkogMdValidation | null;
  onViewDetails?: () => void;
}

/**
 * InkogMdStatus displays the status of an INKOG.md governance manifest.
 * Shows whether the manifest exists, is valid, and its compliance score.
 */
export function InkogMdStatus({
  manifest,
  validation,
  onViewDetails,
}: InkogMdStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasManifest = manifest !== null && manifest !== undefined;
  const isValid = manifest?.is_valid ?? false;
  const score = validation?.score ?? 0;
  const isCompliant = validation?.is_compliant ?? false;

  // Status determination
  const getStatus = () => {
    if (!hasManifest) return 'missing';
    if (!isValid) return 'invalid';
    if (!isCompliant) return 'non_compliant';
    return 'compliant';
  };

  const status = getStatus();

  const statusConfig = {
    missing: {
      icon: XCircle,
      label: 'No INKOG.md',
      color: 'text-gray-500 dark:text-gray-400',
      bgColor: 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
      description: 'Add an INKOG.md file to declare governance policies',
    },
    invalid: {
      icon: AlertTriangle,
      label: 'Invalid',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
      description: 'INKOG.md has parsing errors',
    },
    non_compliant: {
      icon: AlertTriangle,
      label: 'Non-Compliant',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
      description: 'Detected behavior does not match declared governance',
    },
    compliant: {
      icon: CheckCircle2,
      label: 'Compliant',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
      description: 'Agent behavior matches declared governance',
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  // Score color
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

  const sectionIcons = {
    capabilities: Wrench,
    limitations: Shield,
    oversight: Eye,
    data: Database,
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow dark:shadow-gray-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              INKOG.md Governance
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {config.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Score circle (only if manifest exists) */}
          {hasManifest && isValid && (
            <div className="relative w-10 h-10 flex-shrink-0">
              <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="currentColor"
                  className="text-gray-200 dark:text-gray-700"
                  strokeWidth="12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={getScoreStrokeColor(score)}
                  strokeWidth="12"
                  strokeDasharray={`${score * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-xs font-bold ${getScoreColor(score)}`}>
                  {score}
                </span>
              </div>
            </div>
          )}
          {/* Status badge */}
          <span className={`text-xs px-2 py-1 rounded-full border ${config.bgColor} ${config.color}`}>
            <StatusIcon className="w-3 h-3 inline-block mr-1" />
            {config.label}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
          {!hasManifest ? (
            <div className="text-center py-4">
              <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                No INKOG.md found in this project
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Create an INKOG.md file in your project root to declare governance policies.{' '}
                <a
                  href="https://docs.inkog.dev/governance/inkog-md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Learn more
                </a>
              </p>
            </div>
          ) : (
            <>
              {/* Parse Errors */}
              {manifest.parse_errors && manifest.parse_errors.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-md p-3">
                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                    Parse Warnings
                  </h4>
                  <ul className="space-y-1">
                    {manifest.parse_errors.map((error, idx) => (
                      <li key={idx} className="text-xs text-yellow-700 dark:text-yellow-300">
                        Line {error.line}: {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Manifest Sections */}
              <div className="grid grid-cols-2 gap-4">
                {/* Capabilities */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="w-4 h-4 text-blue-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Capabilities
                    </h4>
                    <span className="text-xs text-gray-500">
                      ({manifest.capabilities.length})
                    </span>
                  </div>
                  {manifest.capabilities.length > 0 ? (
                    <ul className="space-y-1">
                      {manifest.capabilities.slice(0, 5).map((cap, idx) => (
                        <li key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                          <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                            {cap.name}
                          </code>
                          {cap.description && (
                            <span className="text-gray-500 ml-1">{cap.description}</span>
                          )}
                        </li>
                      ))}
                      {manifest.capabilities.length > 5 && (
                        <li className="text-xs text-gray-500">
                          +{manifest.capabilities.length - 5} more
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500">None declared</p>
                  )}
                </div>

                {/* Limitations */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-orange-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Limitations
                    </h4>
                    <span className="text-xs text-gray-500">
                      ({manifest.limitations.length})
                    </span>
                  </div>
                  {manifest.limitations.length > 0 ? (
                    <ul className="space-y-1">
                      {manifest.limitations.slice(0, 3).map((lim, idx) => (
                        <li key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="text-orange-600 dark:text-orange-400">
                            [{lim.type}]
                          </span>{' '}
                          {lim.description.substring(0, 40)}
                          {lim.description.length > 40 ? '...' : ''}
                        </li>
                      ))}
                      {manifest.limitations.length > 3 && (
                        <li className="text-xs text-gray-500">
                          +{manifest.limitations.length - 3} more
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500">None declared</p>
                  )}
                </div>

                {/* Human Oversight */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-purple-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Human Oversight
                    </h4>
                  </div>
                  {manifest.human_oversight.require_approval.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-500">Require approval for:</p>
                      <div className="flex flex-wrap gap-1">
                        {manifest.human_oversight.require_approval.map((action, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded"
                          >
                            {action}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No approval gates defined</p>
                  )}
                </div>

                {/* Data Handling */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-green-500" />
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Data Handling
                    </h4>
                    <span className="text-xs text-gray-500">
                      ({manifest.data_handling.length})
                    </span>
                  </div>
                  {manifest.data_handling.length > 0 ? (
                    <ul className="space-y-1">
                      {manifest.data_handling.map((policy, idx) => (
                        <li key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">{policy.category}</span>:{' '}
                          <span className="text-green-600 dark:text-green-400">
                            {policy.action}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-500">No policies defined</p>
                  )}
                </div>
              </div>

              {/* Validation Issues */}
              {validation && !isCompliant && (
                <div className="bg-red-50 dark:bg-red-900/20 rounded-md p-3 space-y-2">
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                    Compliance Issues
                  </h4>
                  {validation.undeclared_capabilities.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-700 dark:text-red-300">
                        Undeclared Capabilities:
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {validation.undeclared_capabilities.map((cap, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {validation.missing_oversight.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-700 dark:text-red-300">
                        Missing Oversight:
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {validation.missing_oversight.map((action, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded"
                          >
                            {action}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {validation.data_policy_violations.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-700 dark:text-red-300">
                        Data Policy Violations ({validation.data_policy_violations.length}):
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {validation.data_policy_violations.slice(0, 3).map((v, idx) => (
                          <li key={idx} className="text-xs text-red-600 dark:text-red-400">
                            {v.file}:{v.line} - {v.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* View Details Link */}
              {onViewDetails && (
                <button
                  onClick={onViewDetails}
                  className="w-full text-center text-sm text-indigo-600 dark:text-indigo-400 hover:underline py-2"
                >
                  View Full Details
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default InkogMdStatus;

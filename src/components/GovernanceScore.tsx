'use client';

interface GovernanceScoreProps {
  score?: number;
  readiness?: 'READY' | 'PARTIAL' | 'NOT_READY';
}

/**
 * GovernanceScore displays the governance score and EU AI Act readiness status.
 * Used in the scan results page to show compliance posture.
 */
export function GovernanceScore({ score, readiness }: GovernanceScoreProps) {
  const readinessColors = {
    'READY': 'text-green-500',
    'PARTIAL': 'text-yellow-500',
    'NOT_READY': 'text-red-500',
  };

  const readinessLabels = {
    'READY': 'Ready',
    'PARTIAL': 'Partial',
    'NOT_READY': 'Not Ready',
  };

  const readinessBgColors = {
    'READY': 'bg-green-100 border-green-200',
    'PARTIAL': 'bg-yellow-100 border-yellow-200',
    'NOT_READY': 'bg-red-100 border-red-200',
  };

  // Default values if not provided
  const displayScore = score ?? 0;
  const displayReadiness = readiness ?? 'NOT_READY';

  // Calculate score color based on value
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-500';
    if (s >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Governance Score</h3>

      <div className="flex items-center gap-6">
        {/* Score Circle */}
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="10"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={displayScore >= 80 ? '#22c55e' : displayScore >= 50 ? '#eab308' : '#ef4444'}
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

        {/* EU AI Act Readiness */}
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-2">EU AI Act Readiness</p>
          <div className={`inline-flex items-center px-3 py-1 rounded-full border ${readinessBgColors[displayReadiness]}`}>
            <span className={`text-sm font-medium ${readinessColors[displayReadiness]}`}>
              {readinessLabels[displayReadiness]}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Deadline: August 2, 2026
          </p>
        </div>
      </div>
    </div>
  );
}

export default GovernanceScore;

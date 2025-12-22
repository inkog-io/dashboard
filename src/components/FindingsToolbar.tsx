"use client";

import { Search, Filter, AlertCircle, AlertTriangle, Info, Check } from "lucide-react";

export type SeverityFilter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface FindingsToolbarProps {
  totalCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  selectedSeverity: SeverityFilter;
  onSeverityChange: (severity: SeverityFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

interface FilterButtonProps {
  label: string;
  count: number;
  isSelected: boolean;
  onClick: () => void;
  variant: "all" | "critical" | "high" | "medium" | "low";
}

function FilterButton({ label, count, isSelected, onClick, variant }: FilterButtonProps) {
  const colors = {
    all: isSelected
      ? "bg-gray-900 text-white border-gray-900"
      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300",
    critical: isSelected
      ? "bg-red-600 text-white border-red-600"
      : "bg-white text-red-700 border-gray-200 hover:border-red-300",
    high: isSelected
      ? "bg-orange-500 text-white border-orange-500"
      : "bg-white text-orange-700 border-gray-200 hover:border-orange-300",
    medium: isSelected
      ? "bg-amber-500 text-white border-amber-500"
      : "bg-white text-amber-700 border-gray-200 hover:border-amber-300",
    low: isSelected
      ? "bg-blue-500 text-white border-blue-500"
      : "bg-white text-blue-700 border-gray-200 hover:border-blue-300",
  };

  const icons = {
    all: <Filter className="w-3.5 h-3.5" />,
    critical: <AlertCircle className="w-3.5 h-3.5" />,
    high: <AlertTriangle className="w-3.5 h-3.5" />,
    medium: <Info className="w-3.5 h-3.5" />,
    low: <Check className="w-3.5 h-3.5" />,
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors duration-150 ${colors[variant]}`}
    >
      {icons[variant]}
      <span>{label}</span>
      <span
        className={`ml-1 px-1.5 py-0.5 text-xs rounded-md ${
          isSelected ? "bg-white/20" : "bg-gray-100"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

export function FindingsToolbar({
  totalCount,
  criticalCount,
  highCount,
  mediumCount,
  lowCount,
  selectedSeverity,
  onSeverityChange,
  searchQuery,
  onSearchChange,
}: FindingsToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
      {/* Severity Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterButton
          label="All"
          count={totalCount}
          isSelected={selectedSeverity === "ALL"}
          onClick={() => onSeverityChange("ALL")}
          variant="all"
        />
        {criticalCount > 0 && (
          <FilterButton
            label="Critical"
            count={criticalCount}
            isSelected={selectedSeverity === "CRITICAL"}
            onClick={() => onSeverityChange("CRITICAL")}
            variant="critical"
          />
        )}
        {highCount > 0 && (
          <FilterButton
            label="High"
            count={highCount}
            isSelected={selectedSeverity === "HIGH"}
            onClick={() => onSeverityChange("HIGH")}
            variant="high"
          />
        )}
        {mediumCount > 0 && (
          <FilterButton
            label="Medium"
            count={mediumCount}
            isSelected={selectedSeverity === "MEDIUM"}
            onClick={() => onSeverityChange("MEDIUM")}
            variant="medium"
          />
        )}
        {lowCount > 0 && (
          <FilterButton
            label="Low"
            count={lowCount}
            isSelected={selectedSeverity === "LOW"}
            onClick={() => onSeverityChange("LOW")}
            variant="low"
          />
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search findings..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-shadow"
        />
      </div>
    </div>
  );
}

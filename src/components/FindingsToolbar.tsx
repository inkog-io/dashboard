"use client";

import { Search, Filter, AlertCircle, AlertTriangle, Info, Check, Shield, Bug } from "lucide-react";

export type SeverityFilter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type TypeFilter = "ALL" | "VULNERABILITY" | "GOVERNANCE";

interface FindingsToolbarProps {
  totalCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  vulnerabilityCount: number;
  governanceCount: number;
  selectedSeverity: SeverityFilter;
  onSeverityChange: (severity: SeverityFilter) => void;
  selectedType: TypeFilter;
  onTypeChange: (type: TypeFilter) => void;
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

interface TypeButtonProps {
  label: string;
  count: number;
  isSelected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

function FilterButton({ label, count, isSelected, onClick, variant }: FilterButtonProps) {
  const colors = {
    all: isSelected
      ? "bg-foreground text-background border-foreground"
      : "bg-card text-foreground border-border hover:border-muted-foreground",
    critical: isSelected
      ? "bg-red-600 text-white border-red-600"
      : "bg-card text-red-700 dark:text-red-400 border-border hover:border-red-300 dark:hover:border-red-500",
    high: isSelected
      ? "bg-orange-500 text-white border-orange-500"
      : "bg-card text-orange-700 dark:text-orange-400 border-border hover:border-orange-300 dark:hover:border-orange-500",
    medium: isSelected
      ? "bg-amber-500 text-white border-amber-500"
      : "bg-card text-amber-700 dark:text-amber-400 border-border hover:border-amber-300 dark:hover:border-amber-500",
    low: isSelected
      ? "bg-blue-500 text-white border-blue-500"
      : "bg-card text-blue-700 dark:text-blue-400 border-border hover:border-blue-300 dark:hover:border-blue-500",
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
          isSelected ? "bg-white/20" : "bg-muted"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function TypeButton({ label, count, isSelected, onClick, icon }: TypeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${
        isSelected
          ? "bg-primary text-primary-foreground"
          : "bg-card text-foreground border border-border hover:bg-accent"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span
        className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
          isSelected
            ? "bg-white/20 text-white"
            : "bg-muted text-muted-foreground"
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
  vulnerabilityCount,
  governanceCount,
  selectedSeverity,
  onSeverityChange,
  selectedType,
  onTypeChange,
  searchQuery,
  onSearchChange,
}: FindingsToolbarProps) {
  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Type Filters - Primary Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <TypeButton
          label="All Findings"
          count={totalCount}
          isSelected={selectedType === "ALL"}
          onClick={() => onTypeChange("ALL")}
          icon={<Filter className="w-4 h-4" />}
        />
        <TypeButton
          label="Vulnerabilities"
          count={vulnerabilityCount}
          isSelected={selectedType === "VULNERABILITY"}
          onClick={() => onTypeChange("VULNERABILITY")}
          icon={<Bug className="w-4 h-4" />}
        />
        <TypeButton
          label="Governance"
          count={governanceCount}
          isSelected={selectedType === "GOVERNANCE"}
          onClick={() => onTypeChange("GOVERNANCE")}
          icon={<Shield className="w-4 h-4" />}
        />
      </div>

      {/* Severity Filters + Search Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search findings..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm bg-card text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow placeholder:text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Search, Calendar, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
  loading?: boolean;
}

export interface FilterState {
  search: string;
  dateFrom: string;
  dateTo: string;
  severity: string;
}

const severityOptions = [
  { value: "", label: "All Severities" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function HistoryFilters({ onFiltersChange, loading }: HistoryFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    dateFrom: "",
    dateTo: "",
    severity: "",
  });

  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters =
    filters.dateFrom || filters.dateTo || filters.severity;

  const updateFilter = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters: FilterState = {
      search: filters.search, // Keep search
      dateFrom: "",
      dateTo: "",
      severity: "",
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const clearAll = () => {
    const clearedFilters: FilterState = {
      search: "",
      dateFrom: "",
      dateTo: "",
      severity: "",
    };
    setFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  return (
    <div className="space-y-3">
      {/* Search and Filter Toggle Row */}
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search scans..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            disabled={loading}
            className={cn(
              "w-full pl-9 pr-4 py-2 text-sm rounded-lg border",
              "bg-white dark:bg-gray-800",
              "border-gray-200 dark:border-gray-700",
              "text-gray-900 dark:text-gray-100",
              "placeholder:text-gray-400 dark:placeholder:text-gray-500",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
          {filters.search && (
            <button
              onClick={() => updateFilter("search", "")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
            showFilters || hasActiveFilters
              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded-full">
              Active
            </span>
          )}
        </button>

        {/* Clear All Button */}
        {(hasActiveFilters || filters.search) && (
          <button
            onClick={clearAll}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Expandable Filters Panel */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-500 dark:text-gray-400">From</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              disabled={loading}
              className={cn(
                "px-2 py-1.5 text-sm rounded border",
                "bg-white dark:bg-gray-700",
                "border-gray-200 dark:border-gray-600",
                "text-gray-900 dark:text-gray-100",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
                "disabled:opacity-50"
              )}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">to</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              disabled={loading}
              className={cn(
                "px-2 py-1.5 text-sm rounded border",
                "bg-white dark:bg-gray-700",
                "border-gray-200 dark:border-gray-600",
                "text-gray-900 dark:text-gray-100",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
                "disabled:opacity-50"
              )}
            />
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Severity</span>
            <select
              value={filters.severity}
              onChange={(e) => updateFilter("severity", e.target.value)}
              disabled={loading}
              className={cn(
                "px-2 py-1.5 text-sm rounded border",
                "bg-white dark:bg-gray-700",
                "border-gray-200 dark:border-gray-600",
                "text-gray-900 dark:text-gray-100",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500",
                "disabled:opacity-50"
              )}
            >
              {severityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

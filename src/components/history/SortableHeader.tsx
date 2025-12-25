"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc" | null;

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSortBy: string;
  currentSortOrder: "asc" | "desc";
  onSort: (key: string, order: "asc" | "desc") => void;
  className?: string;
}

export function SortableHeader({
  label,
  sortKey,
  currentSortBy,
  currentSortOrder,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentSortBy === sortKey;

  const handleClick = () => {
    if (isActive) {
      // Toggle direction
      onSort(sortKey, currentSortOrder === "asc" ? "desc" : "asc");
    } else {
      // Default to descending for new sort
      onSort(sortKey, "desc");
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 text-left font-medium transition-colors",
        "hover:text-gray-900 dark:hover:text-gray-100",
        isActive
          ? "text-gray-900 dark:text-gray-100"
          : "text-gray-500 dark:text-gray-400",
        className
      )}
    >
      {label}
      <span className="w-4 h-4 flex items-center justify-center">
        {isActive ? (
          currentSortOrder === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        )}
      </span>
    </button>
  );
}

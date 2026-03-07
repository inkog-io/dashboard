"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  loading,
}: PaginationProps) {
  const startItem = Math.min((page - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(page * pageSize, totalItems);

  // Generate page numbers to show
  const getPageNumbers = (): (number | "...")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "...")[] = [];

    // Always show first page
    pages.push(1);

    if (page > 3) {
      pages.push("...");
    }

    // Show pages around current
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      if (!pages.includes(i)) {
        pages.push(i);
      }
    }

    if (page < totalPages - 2) {
      pages.push("...");
    }

    // Always show last page
    if (!pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between px-2 py-3">
      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{startItem}</span> to{" "}
        <span className="font-medium text-foreground">{endItem}</span> of{" "}
        <span className="font-medium text-foreground">{totalItems}</span> results
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-1">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          className={cn(
            "p-2 rounded-lg transition-colors",
            page <= 1 || loading
              ? "text-muted-foreground/50 cursor-not-allowed"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((pageNum, idx) =>
            pageNum === "..." ? (
              <span
                key={`ellipsis-${idx}`}
                className="px-2 py-1 text-sm text-muted-foreground"
              >
                ...
              </span>
            ) : (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                disabled={loading}
                className={cn(
                  "min-w-[2rem] h-8 px-2 text-sm font-medium rounded-lg transition-colors",
                  pageNum === page
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  loading && "opacity-50 cursor-not-allowed"
                )}
              >
                {pageNum}
              </button>
            )
          )}
        </div>

        {/* Next button */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || loading}
          className={cn(
            "p-2 rounded-lg transition-colors",
            page >= totalPages || loading
              ? "text-muted-foreground/50 cursor-not-allowed"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          aria-label="Next page"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

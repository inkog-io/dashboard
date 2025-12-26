/**
 * Skeleton Loading Components
 *
 * Provides placeholder loading states for a better user experience.
 * Enterprise-grade skeleton animations for dashboard components.
 */

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton component with pulse animation
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gray-200 dark:bg-gray-700",
        className
      )}
    />
  );
}

/**
 * Text skeleton for paragraphs and titles
 */
export function SkeletonText({
  lines = 1,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton for metric cards on dashboard
 */
export function SkeletonMetricCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 bg-white dark:bg-gray-800">
      <div className="flex items-start justify-between">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/**
 * Skeleton for finding cards in scan results
 */
export function SkeletonFindingCard() {
  return (
    <div className="px-5 py-4 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800">
      <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
      <Skeleton className="h-6 w-16 rounded-md flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <Skeleton className="h-5 w-5 flex-shrink-0" />
    </div>
  );
}

/**
 * Skeleton for scan results summary
 */
export function SkeletonScanSummary() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-28 rounded-lg" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for history table rows
 */
export function SkeletonTableRow() {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="py-4 px-4">
        <Skeleton className="h-4 w-32" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="h-6 w-12 rounded-full" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="py-4 px-4">
        <Skeleton className="h-8 w-8 rounded" />
      </td>
    </tr>
  );
}

/**
 * Skeleton for history table
 */
export function SkeletonHistoryTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <th className="py-3 px-4 text-left">
                <Skeleton className="h-4 w-16" />
              </th>
              <th className="py-3 px-4 text-left">
                <Skeleton className="h-4 w-20" />
              </th>
              <th className="py-3 px-4 text-left">
                <Skeleton className="h-4 w-14" />
              </th>
              <th className="py-3 px-4 text-left">
                <Skeleton className="h-4 w-18" />
              </th>
              <th className="py-3 px-4 text-left">
                <Skeleton className="h-4 w-12" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <SkeletonTableRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Skeleton for API key cards
 */
export function SkeletonApiKeyCard() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  );
}

/**
 * Skeleton for topology map
 */
export function SkeletonTopologyMap() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 h-[400px] flex items-center justify-center">
      <div className="text-center space-y-4">
        <Skeleton className="h-16 w-16 rounded-full mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
        <Skeleton className="h-3 w-48 mx-auto" />
      </div>
    </div>
  );
}

/**
 * Full page loading skeleton
 */
export function SkeletonDashboardPage() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>

      {/* Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SkeletonHistoryTable rows={5} />
        </div>
        <div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 bg-white dark:bg-gray-800 space-y-4">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for scan results page
 */
export function SkeletonScanResults() {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <SkeletonScanSummary />

      {/* Findings */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <Skeleton className="h-5 w-32" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonFindingCard key={i} />
        ))}
      </div>
    </div>
  );
}

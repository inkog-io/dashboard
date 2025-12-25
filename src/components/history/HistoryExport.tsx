"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Scan } from "@/lib/api";

interface HistoryExportProps {
  scans: Scan[];
  loading?: boolean;
}

/**
 * Converts scan data to CSV format
 */
function toCSV(scans: Scan[]): string {
  const headers = [
    "Date",
    "Scan ID",
    "Files Scanned",
    "Lines of Code",
    "Total Findings",
    "Critical",
    "High",
    "Medium",
    "Low",
    "Risk Score",
    "Duration (ms)",
  ];

  const rows = scans.map((scan) => [
    new Date(scan.created_at).toISOString(),
    scan.id,
    scan.files_scanned,
    scan.lines_of_code,
    scan.findings_count,
    scan.critical_count,
    scan.high_count,
    scan.medium_count,
    scan.low_count,
    scan.risk_score,
    scan.duration_ms,
  ]);

  // Escape CSV values
  const escape = (val: unknown): string => {
    const str = String(val ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\n");

  return csvContent;
}

/**
 * Triggers a file download in the browser
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function HistoryExport({ scans, loading }: HistoryExportProps) {
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    if (scans.length === 0) return;

    setExporting(true);
    try {
      const csv = toCSV(scans);
      const date = new Date().toISOString().split("T")[0];
      downloadFile(csv, `inkog-scan-history-${date}.csv`, "text/csv");
    } finally {
      // Small delay to show the loading state
      setTimeout(() => setExporting(false), 300);
    }
  };

  const disabled = loading || exporting || scans.length === 0;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportCSV}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors",
          disabled
            ? "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        )}
        title={scans.length === 0 ? "No data to export" : "Export to CSV"}
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" />
        )}
        Export CSV
      </button>

      {/* Scan count badge */}
      {scans.length > 0 && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {scans.length} {scans.length === 1 ? "scan" : "scans"}
        </span>
      )}
    </div>
  );
}

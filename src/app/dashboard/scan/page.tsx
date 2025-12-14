"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Upload, FileCode, AlertCircle, CheckCircle2, Loader2, Shield, Info } from "lucide-react";

import { createAPIClient, type Finding, type ScanResult, type InkogAPI } from "@/lib/api";

// Severity badge component
function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-800 border-red-200",
    HIGH: "bg-orange-100 text-orange-800 border-orange-200",
    MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
    LOW: "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${colors[severity] || colors.LOW}`}>
      {severity}
    </span>
  );
}

export default function ScanPage() {
  const { getToken } = useAuth();
  const [api, setApi] = useState<InkogAPI | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Initialize API client
  useEffect(() => {
    const client = createAPIClient(getToken);
    setApi(client);
  }, [getToken]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => {
      // Accept common code file extensions
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const allowedExtensions = ['py', 'js', 'ts', 'jsx', 'tsx', 'go', 'java', 'rb', 'json', 'yaml', 'yml', 'md'];
      return allowedExtensions.includes(ext) || file.type.startsWith('text/');
    });

    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
      setError(null);
      setResult(null);
    }
  }, []);

  // Handle file input change
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      setFiles((prev) => [...prev, ...selectedFiles]);
      setError(null);
      setResult(null);
    }
  }, []);

  // Remove a file from the list
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
    setResult(null);
    setError(null);
  }, []);

  // Run the scan
  const runScan = useCallback(async () => {
    if (!api || files.length === 0) return;

    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const scanResult = await api.scan.upload(files);
      setResult(scanResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [api, files]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Web Scanner</h1>
        <p className="text-gray-600 mt-1">
          Upload code files to scan for AI agent vulnerabilities
        </p>
      </div>

      {/* Privacy Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">Privacy Notice</p>
          <p>Files are processed ephemerally and not stored. For maximum privacy, use the CLI for local-only scanning.</p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-700 mb-2">
          Drag & drop code files here
        </p>
        <p className="text-sm text-gray-500 mb-4">
          or click to browse
        </p>
        <input
          type="file"
          multiple
          accept=".py,.js,.ts,.jsx,.tsx,.go,.java,.rb,.json,.yaml,.yml,.md"
          onChange={handleFileInput}
          className="hidden"
          id="file-input"
        />
        <label
          htmlFor="file-input"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
        >
          <FileCode className="h-4 w-4" />
          Select Files
        </label>
        <p className="text-xs text-gray-400 mt-4">
          Supported: Python, JavaScript, TypeScript, Go, Java, Ruby, JSON, YAML
        </p>
      </div>

      {/* Selected Files */}
      {files.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-gray-900">
              Selected Files ({files.length})
            </h3>
            <button
              onClick={clearFiles}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          </div>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {files.map((file, index) => (
              <li
                key={index}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{file.name}</span>
                  <span className="text-xs text-gray-400">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-400 hover:text-red-500"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={runScan}
            disabled={scanning}
            className="mt-4 w-full py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {scanning ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Shield className="h-5 w-5" />
                Start Scan
              </>
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Scan Complete
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{result.summary.files_scanned}</p>
                <p className="text-xs text-gray-500 uppercase">Files Scanned</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{result.summary.findings_count}</p>
                <p className="text-xs text-gray-500 uppercase">Total Findings</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{result.summary.critical_count}</p>
                <p className="text-xs text-gray-500 uppercase">Critical</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">{result.summary.high_count}</p>
                <p className="text-xs text-gray-500 uppercase">High</p>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500 text-center">
              Scanned {result.summary.lines_of_code.toLocaleString()} lines of code in {result.summary.duration_ms}ms
            </div>
          </div>

          {/* Findings Table */}
          {result.findings.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-medium text-gray-900">Findings</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Severity
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        File
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Issue
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CWE
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {result.findings.map((finding, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <SeverityBadge severity={finding.severity} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                            {finding.file}:{finding.line}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-md truncate">
                          {finding.message}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {finding.cwe || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium text-green-800">No vulnerabilities found!</p>
              <p className="text-sm text-green-600 mt-1">Your code passed all security checks.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

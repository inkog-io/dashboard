"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import {
  Upload,
  FileCode,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  Info,
  Terminal,
  ArrowRight,
  Plus,
  Bot,
  X,
  AlertTriangle,
  FileText,
} from "lucide-react";

import {
  createAPIClient,
  InkogAPIError,
  type Finding,
  type ScanResult,
  type InkogAPI,
} from "@/lib/api";
import {
  getFindingType,
  matchesFindingSearch,
  matchesFramework,
  frameworkDisplayNames,
} from "@/lib/finding-utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GovernanceScore } from "@/components/GovernanceScore";
import { TopologyMapVisualization } from "@/components/TopologyMap";
import { GroupedFindings } from "@/components/GroupedFindings";
import { FindingDetailsPanel } from "@/components/FindingDetailsPanel";
import { FindingsToolbar, type SeverityFilter, type TypeFilter } from "@/components/FindingsToolbar";
import { PolicySelector, type ScanPolicy, getStoredPolicy } from "@/components/PolicySelector";

export default function ScanPage() {
  const { getToken } = useAuth();
  const [api, setApi] = useState<InkogAPI | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scanPolicy, setScanPolicy] = useState<ScanPolicy>("balanced");
  const [agentName, setAgentName] = useState("");

  // Findings panel state
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [frameworkFilter, setFrameworkFilter] = useState<string | null>(null);

  // Initialize API client
  useEffect(() => {
    const client = createAPIClient(getToken);
    setApi(client);
  }, [getToken]);

  // Load stored policy preference
  useEffect(() => {
    setScanPolicy(getStoredPolicy());
  }, []);

  // Check if AGENTS.md was uploaded (for governance manifest warning)
  const hasAgentsMD = useMemo(() => {
    return files.some(f => f.name.toLowerCase() === 'agents.md');
  }, [files]);

  // Compute type counts from findings using shared utility
  const typeCounts = useMemo(() => {
    if (!result?.findings) return { vulnerability: 0, governance: 0 };

    return result.findings.reduce(
      (acc, finding) => {
        const type = getFindingType(finding);
        if (type === "governance_violation") {
          acc.governance++;
        } else {
          acc.vulnerability++;
        }
        return acc;
      },
      { vulnerability: 0, governance: 0 }
    );
  }, [result?.findings]);

  // Filter findings based on type, severity, framework and search using shared utilities
  const filteredFindings = useMemo(() => {
    if (!result?.findings) return [];

    return result.findings.filter((finding) => {
      // Type filter using shared utility
      if (typeFilter !== "ALL") {
        const findingType = getFindingType(finding);
        if (typeFilter === "VULNERABILITY" && findingType !== "vulnerability") {
          return false;
        }
        if (typeFilter === "GOVERNANCE" && findingType !== "governance_violation") {
          return false;
        }
      }

      // Severity filter
      if (severityFilter !== "ALL" && finding.severity !== severityFilter) {
        return false;
      }

      // Framework filter (from clicking governance items)
      if (frameworkFilter) {
        if (!matchesFramework(finding, frameworkFilter)) {
          return false;
        }
      }

      // Search filter using shared utility (includes compliance fields)
      if (searchQuery) {
        if (!matchesFindingSearch(finding, searchQuery)) {
          return false;
        }
      }

      return true;
    });
  }, [result?.findings, typeFilter, severityFilter, frameworkFilter, searchQuery]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const allowedExtensions = [
        "py",
        "js",
        "ts",
        "jsx",
        "tsx",
        "go",
        "java",
        "rb",
        "json",
        "yaml",
        "yml",
        "md",
      ];
      return allowedExtensions.includes(ext) || file.type.startsWith("text/");
    });

    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
      setError(null);
      setResult(null);
    }
  }, []);

  // Handle file input change
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length > 0) {
        setFiles((prev) => [...prev, ...selectedFiles]);
        setError(null);
        setResult(null);
      }
    },
    []
  );

  // Remove a file from the list
  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
    setResult(null);
    setError(null);
    setSeverityFilter("ALL");
    setTypeFilter("ALL");
    setSearchQuery("");
  }, []);

  // Run the scan
  const runScan = useCallback(async () => {
    if (!api || files.length === 0) return;

    setScanning(true);
    setError(null);
    setResult(null);
    setSelectedFinding(null);
    setSeverityFilter("ALL");
    setTypeFilter("ALL");
    setSearchQuery("");
    setFrameworkFilter(null);

    try {
      // Pass scan policy and agent name to backend
      const scanResult = await api.scan.upload(files, scanPolicy, agentName || undefined);
      setResult(scanResult);
    } catch (err) {
      if (err instanceof InkogAPIError) {
        setError(`${err.message} (${err.code})`);
      } else {
        setError(err instanceof Error ? err.message : "Scan failed");
      }
    } finally {
      setScanning(false);
    }
  }, [api, files, scanPolicy, agentName]);

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          AI Agent Security Scanner
        </h1>
        <p className="text-muted-foreground mt-1">
          Detect vulnerabilities and governance gaps in LangChain, CrewAI, n8n,
          and custom AI agents
        </p>
      </div>

      {/* Upload Section - Hidden when results exist */}
      {!result && (
        <>
          {/* Privacy Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Privacy Notice</p>
              <p>
                Files are processed ephemerally and not stored. For maximum privacy,
                use the CLI for local-only scanning.
              </p>
            </div>
          </div>

          {/* Web Scanner Limitations Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Quick Preview Mode</p>
              <p>
                This web scanner is for previewing individual files.
                For full project analysis with AGENTS.md governance validation:
              </p>
              <ul className="mt-2 space-y-1 list-disc list-inside text-amber-700">
                <li><strong>CLI:</strong> <code className="bg-amber-100 px-1 rounded">inkog scan ./your-project</code></li>
                <li><strong>API:</strong> Programmatic access for custom integrations</li>
                <li><strong>CI/CD:</strong> GitHub Actions, GitLab CI integration</li>
              </ul>
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
              Quick Scan Preview
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Drag & drop files to test Inkog&apos;s detection capabilities
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
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

          {/* Policy Selector */}
          <div className="mt-4 mb-3">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Scan Policy
            </label>
            <PolicySelector value={scanPolicy} onChange={setScanPolicy} />
          </div>

          {/* Agent Name */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              Agent Name
            </label>
            <input
              type="text"
              placeholder="e.g., customer-support-bot"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">Leave blank to auto-detect from filename</p>
          </div>

          <button
            onClick={runScan}
            disabled={scanning}
            className="w-full py-3 bg-black dark:bg-white text-white dark:text-black font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
        </>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Agent Name Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {agentName || 'Scan Results'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {result.files_scanned} files scanned • {result.findings_count} findings • {result.scan_duration}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setResult(null);
                setFiles([]);
                setError(null);
                setSelectedFinding(null);
                setSeverityFilter("ALL");
                setTypeFilter("ALL");
                setAgentName("");
                setSearchQuery("");
                setFrameworkFilter(null);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Scan
            </button>
          </div>

          {/* Summary Stats */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">
                  {result.files_scanned}
                </p>
                <p className="text-xs text-gray-500 uppercase">Files Scanned</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">
                  {result.findings_count}
                </p>
                <p className="text-xs text-gray-500 uppercase">Total Findings</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">
                  {result.critical_count}
                </p>
                <p className="text-xs text-gray-500 uppercase">Critical</p>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">
                  {result.high_count}
                </p>
                <p className="text-xs text-gray-500 uppercase">High</p>
              </div>
            </div>
            <div className="mt-4 text-sm text-gray-500 text-center">
              Scanned {result.lines_of_code.toLocaleString()} lines of code in{" "}
              {result.scan_duration || "0ms"}
            </div>
          </div>

          {/* Governance Section */}
          {(result.governance_score !== undefined ||
            result.eu_ai_act_readiness) && (
            <ErrorBoundary>
              <GovernanceScore
                score={result.governance_score}
                readiness={result.eu_ai_act_readiness}
                articleMapping={result.article_mapping}
                frameworkMapping={result.framework_mapping}
                onFrameworkClick={(frameworkId) => {
                  // Set framework filter instead of search query
                  setFrameworkFilter(frameworkId);
                  setSearchQuery('');
                  document.getElementById('findings-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
                onArticleClick={(article) => {
                  // For articles, search by the specific article name
                  setSearchQuery(article);
                  setFrameworkFilter(null);
                  document.getElementById('findings-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            </ErrorBoundary>
          )}

          {/* Agent Topology Visualization */}
          {result.topology_map && (
            <ErrorBoundary
              fallback={
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                  <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-amber-800 font-medium">
                    Topology visualization failed to load
                  </p>
                  <p className="text-sm text-amber-600 mt-1">
                    Your scan results are still available below.
                  </p>
                </div>
              }
            >
              <TopologyMapVisualization
                topology={result.topology_map}
                findings={result.findings}
                onFindingClick={(findingId) => {
                  const finding = result.findings.find((f) => f.id === findingId);
                  if (finding) {
                    setSelectedFinding(finding);
                  }
                }}
              />
            </ErrorBoundary>
          )}

          {/* Missing Governance Manifest Warning */}
          {!hasAgentsMD && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
              <FileText className="h-5 w-5 text-indigo-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-indigo-800">
                <p className="font-medium">No Governance Manifest Found</p>
                <p>
                  Add an <code className="bg-indigo-100 px-1 rounded">AGENTS.md</code> to your project root to enable governance
                  mismatch detection. This validates your declared capabilities against actual code behavior.
                </p>
                <a
                  href="https://docs.inkog.io/governance/agents-md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 underline mt-1 inline-block hover:text-indigo-800"
                >
                  Learn about AGENTS.md →
                </a>
              </div>
            </div>
          )}

          {/* CLI Upsell Banner */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Terminal className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">
                  Want full project scanning with governance validation?
                </p>
                <p className="text-sm text-gray-600">
                  The CLI scans entire directories, validates AGENTS.md constraints,
                  and integrates with CI/CD pipelines.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/api-keys"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              Get CLI Access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Findings Section */}
          {result.findings.length > 0 ? (
            <div id="findings-section" className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden scroll-mt-4">
              <div className="px-5 border-b border-gray-100 dark:border-gray-800">
                <FindingsToolbar
                  totalCount={result.findings_count}
                  criticalCount={result.critical_count}
                  highCount={result.high_count}
                  mediumCount={result.medium_count}
                  lowCount={result.low_count}
                  vulnerabilityCount={typeCounts.vulnerability}
                  governanceCount={typeCounts.governance}
                  selectedSeverity={severityFilter}
                  onSeverityChange={setSeverityFilter}
                  selectedType={typeFilter}
                  onTypeChange={setTypeFilter}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              </div>

              {/* Framework Filter Indicator */}
              {frameworkFilter && (
                <div className="px-5 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      Filtered by: <strong>{frameworkDisplayNames[frameworkFilter] || frameworkFilter}</strong>
                    </span>
                    <button
                      onClick={() => setFrameworkFilter(null)}
                      className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      Clear filter
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Findings List */}
              {filteredFindings.length > 0 ? (
                <GroupedFindings
                  findings={filteredFindings}
                  onFindingClick={(finding) => setSelectedFinding(finding)}
                />
              ) : (
                <div className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                  No findings match your filters
                </div>
              )}

              {/* Results count */}
              {filteredFindings.length > 0 && (
                <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  Showing {filteredFindings.length} of {result.findings_count}{" "}
                  findings
                </div>
              )}
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium text-green-800">
                No vulnerabilities found!
              </p>
              <p className="text-sm text-green-600 mt-1">
                Your code passed all security checks.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Finding Details Panel (Slide-out) */}
      <FindingDetailsPanel
        finding={selectedFinding}
        open={!!selectedFinding}
        onClose={() => setSelectedFinding(null)}
      />
    </div>
  );
}
